package backend.dto;

import java.util.List;

public record QuizHistoryResponse(
        List<QuizSessionHistoryItemResponse> sessions,
        List<QuizMatchHistoryItemResponse> matches
) {
}
