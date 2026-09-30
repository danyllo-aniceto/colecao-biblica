package backend.dto;

public record RankingEntryResponse(
        int position,
        Long userId,
        String userName,
        int level,
        int totalScore,
        int xp
) {
}
