package in.bushansirgur.cloudshareapi.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import in.bushansirgur.cloudshareapi.document.FileMetadataDocument;
import in.bushansirgur.cloudshareapi.document.ProfileDocument;
import in.bushansirgur.cloudshareapi.dto.FileMetadataDTO;
import in.bushansirgur.cloudshareapi.repository.FileMetadataRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FileMetadataService {

    private final ProfileService profileService;
    private final UserCreditsService userCreditsService;
    private final FileMetadataRepository fileMetadataRepository;
    private final Cloudinary cloudinary;

    // Used only to stream file bytes back through our own backend on download.
    private final RestTemplate restTemplate = new RestTemplate();

    public List<FileMetadataDTO> uploadFiles(MultipartFile[] files) throws IOException {
        ProfileDocument currentProfile = profileService.getCurrentProfile();
        List<FileMetadataDocument> savedFiles = new ArrayList<>();

        if (!userCreditsService.hasEnoughCredits(files.length)) {
            throw new RuntimeException("Not enough credits to upload files. Please purchase more credits");
        }

        for (MultipartFile file : files) {
            // "resource_type: auto" lets Cloudinary figure out image / video / raw (pdf, docx, zip, etc.)
            // Files are namespaced per-user under cloudshare/<clerkId> for easier housekeeping in the dashboard.
            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "resource_type", "auto",
                    "folder", "cloudshare/" + currentProfile.getClerkId(),
                    "use_filename", true,
                    "unique_filename", true
            ));

            FileMetadataDocument fileMetadata = FileMetadataDocument.builder()
                    .fileUrl((String) uploadResult.get("secure_url"))
                    .cloudinaryPublicId((String) uploadResult.get("public_id"))
                    .resourceType((String) uploadResult.get("resource_type"))
                    .name(file.getOriginalFilename())
                    .size(file.getSize())
                    .type(file.getContentType())
                    .clerkId(currentProfile.getClerkId())
                    .isPublic(false)
                    .uploadedAt(LocalDateTime.now())
                    .build();

            userCreditsService.consumeCredit();

            savedFiles.add(fileMetadataRepository.save(fileMetadata));
        }
        return savedFiles.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    private FileMetadataDTO mapToDTO(FileMetadataDocument fileMetadataDocument) {
        return FileMetadataDTO.builder()
                .id(fileMetadataDocument.getId())
                .fileUrl(fileMetadataDocument.getFileUrl())
                .name(fileMetadataDocument.getName())
                .size(fileMetadataDocument.getSize())
                .type(fileMetadataDocument.getType())
                .clerkId(fileMetadataDocument.getClerkId())
                .isPublic(fileMetadataDocument.getIsPublic())
                .uploadedAt(fileMetadataDocument.getUploadedAt())
                .build();
    }

    public List<FileMetadataDTO> getFiles() {
        ProfileDocument currentProfile = profileService.getCurrentProfile();
        List<FileMetadataDocument> files = fileMetadataRepository.findByClerkId(currentProfile.getClerkId());
        return files.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public FileMetadataDTO getPublicFile(String id) {
        FileMetadataDocument document = fileMetadataRepository.findById(id)
                .filter(FileMetadataDocument::getIsPublic)
                .orElseThrow(() -> new RuntimeException("Unable to get the file"));

        return mapToDTO(document);
    }

    public FileMetadataDTO getDownloadableFile(String id) {
        FileMetadataDocument file = fileMetadataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("File not found"));
        return mapToDTO(file);
    }

    /**
     * Downloads the file bytes from Cloudinary on the server side and hands them back
     * to the controller, so the browser only ever talks to our own backend — no CORS
     * headaches with Cloudinary and no need for the frontend to change at all.
     */
    public byte[] fetchFileBytes(String fileUrl) {
        return restTemplate.getForObject(fileUrl, byte[].class);
    }

    public void deleteFile(String id) {
        try {
            ProfileDocument currentProfile = profileService.getCurrentProfile();
            FileMetadataDocument file = fileMetadataRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("File not found"));

            if (!file.getClerkId().equals(currentProfile.getClerkId())) {
                throw new RuntimeException("File does not belong to current user");
            }

            // Remove the actual file from Cloudinary too, not just our own database record.
            cloudinary.uploader().destroy(file.getCloudinaryPublicId(),
                    ObjectUtils.asMap("resource_type", file.getResourceType()));

            fileMetadataRepository.deleteById(id);
        } catch (Exception e) {
            throw new RuntimeException("Error deleting the file");
        }
    }

    public FileMetadataDTO togglePublic(String id) {
        FileMetadataDocument file = fileMetadataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("File not found"));

        file.setIsPublic(!file.getIsPublic());
        fileMetadataRepository.save(file);
        return mapToDTO(file);
    }
}
