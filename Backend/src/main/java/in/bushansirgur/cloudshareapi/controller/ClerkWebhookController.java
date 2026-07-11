package in.bushansirgur.cloudshareapi.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.bushansirgur.cloudshareapi.dto.ProfileDTO;
import in.bushansirgur.cloudshareapi.service.ProfileService;
import in.bushansirgur.cloudshareapi.service.UserCreditsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/webhooks")
@RequiredArgsConstructor
public class ClerkWebhookController {

    @Value("${clerk.webhook.secret}")
    private String webhookSecret;

    private final ProfileService profileService;
    private final UserCreditsService userCreditsService;

    @PostMapping("/clerk")
    public ResponseEntity<?> handleClerkWebhook(
            @RequestHeader("svix-id") String svixId,
            @RequestHeader("svix-timestamp") String svixTimestamp,
            @RequestHeader("svix-signature") String svixSignature,
            @RequestBody String payload) {

        try {

            System.out.println("======================================");
            System.out.println("CLERK WEBHOOK RECEIVED");
            System.out.println("Svix ID : " + svixId);
            System.out.println("Timestamp : " + svixTimestamp);
            System.out.println("Payload : " + payload);
            System.out.println("======================================");

            boolean isValid = verifyWebhookSignature(
                    svixId,
                    svixTimestamp,
                    svixSignature,
                    payload);

            if (!isValid) {
                System.out.println("Invalid Webhook Signature");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body("Invalid webhook signature");
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(payload);

            String eventType = rootNode.path("type").asText();

            System.out.println("Event Type : " + eventType);

            switch (eventType) {

                case "user.created":
                    System.out.println("Calling handleUserCreated()");
                    handleUserCreated(rootNode.path("data"));
                    break;

                case "user.updated":
                    System.out.println("Calling handleUserUpdated()");
                    handleUserUpdated(rootNode.path("data"));
                    break;

                case "user.deleted":
                    System.out.println("Calling handleUserDeleted()");
                    handleUserDeleted(rootNode.path("data"));
                    break;

                default:
                    System.out.println("Unknown Event : " + eventType);
            }

            System.out.println("Webhook Completed Successfully");

            return ResponseEntity.ok("Webhook Processed Successfully");

        } catch (Exception e) {

            System.out.println("======================================");
            System.out.println("WEBHOOK ERROR");
            e.printStackTrace();
            System.out.println("======================================");

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(e.getMessage());
        }
    }

    private void handleUserCreated(JsonNode data) {

        System.out.println("Inside handleUserCreated()");

        String clerkId = data.path("id").asText();

        System.out.println("Clerk ID : " + clerkId);

        String email = "";

        JsonNode emailAddresses = data.path("email_addresses");

        if (emailAddresses.isArray() && emailAddresses.size() > 0) {
            email = emailAddresses.get(0).path("email_address").asText();
        }

        String firstName = data.path("first_name").asText("");
        String lastName = data.path("last_name").asText("");
        String photoUrl = data.path("image_url").asText("");

        ProfileDTO newProfile = ProfileDTO.builder()
                .clerkId(clerkId)
                .firstName(firstName)
                .lastName(lastName)
                .email(email)
                .photoUrl(photoUrl)
                .build();

        System.out.println("Saving Profile...");

        profileService.createProfile(newProfile);

        System.out.println("Profile Saved Successfully");

        System.out.println("Creating Initial Credits...");

        userCreditsService.createInitialCredits(clerkId);

        System.out.println("Credits Created Successfully");
    }

    private void handleUserUpdated(JsonNode data) {

        System.out.println("Inside handleUserUpdated()");

        String clerkId = data.path("id").asText();

        String email = "";

        JsonNode emailAddresses = data.path("email_addresses");

        if (emailAddresses.isArray() && emailAddresses.size() > 0) {
            email = emailAddresses.get(0).path("email_address").asText();
        }

        String firstName = data.path("first_name").asText("");
        String lastName = data.path("last_name").asText("");
        String photoUrl = data.path("image_url").asText("");

        ProfileDTO updatedProfile = ProfileDTO.builder()
                .clerkId(clerkId)
                .firstName(firstName)
                .lastName(lastName)
                .email(email)
                .photoUrl(photoUrl)
                .build();

        updatedProfile = profileService.updateProfile(updatedProfile);

        if (updatedProfile == null) {
            System.out.println("Profile Not Found. Creating New Profile...");
            handleUserCreated(data);
        }
    }

    private void handleUserDeleted(JsonNode data) {

        System.out.println("Inside handleUserDeleted()");

        String clerkId = data.path("id").asText();

        profileService.deleteProfile(clerkId);

        System.out.println("Profile Deleted");
    }

    private boolean verifyWebhookSignature(
            String svixId,
            String svixTimestamp,
            String svixSignature,
            String payload) {

        // Signature verification temporarily disabled for debugging

        return true;
    }
}