package backend.dto;

import backend.model.QuestionDifficulty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CreateQuestionRequest(
        @NotBlank String text,
        @NotNull QuestionDifficulty difficulty,
        @Min(5) @Max(120) Integer timeLimitSeconds,
        @NotBlank String optionA,
        @NotBlank String optionB,
        @NotBlank String optionC,
        @NotBlank String optionD,
        @NotBlank @Pattern(regexp = "[ABCDabcd]") String correctOption,
        Long relatedCharacterId,
        Boolean active
) {
}
