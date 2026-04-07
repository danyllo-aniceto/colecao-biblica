package backend.dto;

public record AnswerQuizQuestionResponse(
        boolean correct,
        int livesRemaining,
        int correctAnswers,
        int wrongAnswers,
        boolean finished,
        QuizQuestionViewResponse nextQuestion,
        QuizMatchResultResponse matchResult
) {
}
