package backend.dto;

import backend.model.QuizType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record StartQuizSessionRequest(
        @NotNull QuizType quizType,
        Long characterId,
        @Min(1) @Max(100) Integer questionLimit
) {
}
