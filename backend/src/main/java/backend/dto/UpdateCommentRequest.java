package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCommentRequest(@NotBlank @Size(max = 2000) String text) {
}
