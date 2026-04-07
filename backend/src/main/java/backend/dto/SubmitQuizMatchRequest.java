package backend.dto;

import backend.model.QuizType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SubmitQuizMatchRequest(
        @NotNull QuizType quizType,
        @NotNull @Min(0) Integer questionsAnswered,
        @NotNull @Min(0) Integer correctAnswers,
        @NotNull @Min(0) Integer wrongAnswers,
        Long characterId
) {
}
