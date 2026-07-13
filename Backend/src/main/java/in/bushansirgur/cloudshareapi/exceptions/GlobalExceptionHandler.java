package in.bushansirgur.cloudshareapi.exceptions;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<?> handleDuplicateEmailException(DuplicateKeyException ex) {
        Map<String, Object> data = new HashMap<>();
        data.put("status", HttpStatus.CONFLICT);
        data.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(data);
    }

    // Catch-all so that ANY unexpected error (missing data, null values, bad input, etc.)
    // returns a normal JSON error response instead of being forwarded to Spring's default
    // "/error" page. That forward was silently being blocked by Spring Security (since
    // "/error" isn't in the permitAll list), which turned real errors into confusing,
    // empty-body 403s on public/unauthenticated routes.
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<?> handleRuntimeException(RuntimeException ex) {
        Map<String, Object> data = new HashMap<>();
        data.put("status", HttpStatus.BAD_REQUEST);
        data.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(data);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGenericException(Exception ex) {
        Map<String, Object> data = new HashMap<>();
        data.put("status", HttpStatus.INTERNAL_SERVER_ERROR);
        data.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(data);
    }
}
