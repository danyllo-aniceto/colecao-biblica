package backend.dto;

import backend.model.QuestionDifficulty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateQuestionRequest(
        @Size(min = 1) String text,
        QuestionDifficulty difficulty,
        @Min(5) @Max(120) Integer timeLimitSeconds,
        @Size(min = 1) String optionA,
        @Size(min = 1) String optionB,
        @Size(min = 1) String optionC,
        @Size(min = 1) String optionD,
        @Pattern(regexp = "[ABCDabcd]") String correctOption,
        Long relatedCharacterId,
        Boolean active
) {
}
