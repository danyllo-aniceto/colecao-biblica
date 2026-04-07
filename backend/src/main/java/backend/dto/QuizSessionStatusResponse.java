package backend.dto;

import backend.model.QuizSessionStatus;
import backend.model.QuizType;

public record QuizSessionStatusResponse(
        Long sessionId,
        QuizType quizType,
        QuizSessionStatus status,
        int totalQuestions,
        int currentQuestionIndex,
        int livesRemaining,
        int correctAnswers,
        int wrongAnswers,
        double xpMultiplier,
        QuizQuestionViewResponse currentQuestion
) {
}
