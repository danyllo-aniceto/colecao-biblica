package backend.dto;

import backend.model.QuestionDifficulty;

public record QuizQuestionViewResponse(
        Long id,
        String text,
        QuestionDifficulty difficulty,
        int timeLimitSeconds,
        String optionA,
        String optionB,
        String optionC,
        String optionD
) {
}
