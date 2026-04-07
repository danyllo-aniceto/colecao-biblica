package backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record AnswerQuizQuestionRequest(
        @NotNull Long questionId,
        @NotNull @Pattern(regexp = "[ABCDabcd]") String selectedOption,
        Boolean useExtraTime,
        Boolean useExtraLife,
        Boolean useXpMultiplier
) {
}
