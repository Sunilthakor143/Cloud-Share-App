package in.bushansirgur.cloudshareapi.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "files")
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
public class FileMetadataDocument {

    @Id
    private String id;
    private String name;
    private String type;
    private Long size;
    private String clerkId;
    private Boolean isPublic;

    // Cloudinary storage details (replaces old local-disk fileLocation)
    private String fileUrl;            // secure_url returned by Cloudinary
    private String cloudinaryPublicId; // needed to delete the file later
    private String resourceType;       // "image" | "video" | "raw" - needed for delete/fetch

    private LocalDateTime uploadedAt;
}
