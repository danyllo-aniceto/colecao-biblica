package backend.dto;

import backend.model.QuestionDifficulty;

public record QuestionResponse(
        Long id,
        String text,
        QuestionDifficulty difficulty,
        Integer timeLimitSeconds,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctOption,
        Long relatedCharacterId,
        String relatedCharacterName,
        boolean active
) {
}
