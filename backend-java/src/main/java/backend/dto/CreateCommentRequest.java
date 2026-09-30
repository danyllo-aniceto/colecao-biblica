package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCommentRequest(
        @NotNull Long characterId,
        @NotBlank @Size(max = 2000) String text
) {
}
