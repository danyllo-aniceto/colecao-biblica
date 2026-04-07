package backend.dto;

import backend.model.QuizSessionStatus;
import backend.model.QuizType;

import java.time.Instant;

public record QuizSessionHistoryItemResponse(
        Long sessionId,
        QuizType quizType,
        QuizSessionStatus status,
        Instant startedAt,
        Instant finishedAt,
        int totalQuestions,
        int correctAnswers,
        int wrongAnswers,
        int livesRemaining
) {
}
