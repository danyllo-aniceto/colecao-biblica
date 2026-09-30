package backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Resposta da pergunta atual. {@code selectedOption} nulo indica que o tempo acabou sem resposta.
 */
public record AnswerQuizQuestionRequest(
        @NotNull Long questionId,
        @Pattern(regexp = "[ABCDabcd]") String selectedOption,
        Boolean useExtraLife,
        Boolean useXpMultiplier
) {
}
