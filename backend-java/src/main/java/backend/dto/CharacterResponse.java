package backend.dto;

import backend.model.StickerRarity;

import java.time.Instant;

public record CharacterResponse(
        Long id,
        String name,
        String imageUrl,
        StickerRarity rarity,
        String shortSummary,
        String fullDescription,
        String bibleBooks,
        String bibleReferences,
        String historicalPeriod,
        String narrativeRole,
        String genealogy,
        String curiosities,
        String importantEvents,
        String keyVerses,
        String keywords,
        Instant createdAt,
        String createdBy,
        Instant updatedAt
) {
}
