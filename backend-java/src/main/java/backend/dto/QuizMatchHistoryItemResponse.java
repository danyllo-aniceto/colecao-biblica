package backend.dto;

import backend.model.QuizType;

import java.time.Instant;

public record QuizMatchHistoryItemResponse(
        Long matchId,
        QuizType quizType,
        Instant startedAt,
        Instant finishedAt,
        int questionsAnswered,
        int correctAnswers,
        int wrongAnswers,
        int xpGained,
        int scoreGained,
        boolean rewardGranted,
        String rewardGrantedName
) {
}
