package backend.dto;

public record AnswerQuizQuestionResponse(
        boolean correct,
        boolean timedOut,
        int livesRemaining,
        int correctAnswers,
        int wrongAnswers,
        boolean finished,
        boolean extraTimeUsed,
        boolean extraLifeUsed,
        boolean xpMultiplierUsed,
        QuizQuestionViewResponse nextQuestion,
        QuizMatchResultResponse matchResult
) {
}
