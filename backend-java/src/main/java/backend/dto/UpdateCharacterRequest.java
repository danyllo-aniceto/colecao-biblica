package backend.dto;

import backend.model.StickerRarity;
import jakarta.validation.constraints.Size;

public record UpdateCharacterRequest(
        @Size(min = 1, max = 150) String name,
        @Size(min = 1, max = 5000000) String imageUrl,
        StickerRarity rarity,
        @Size(min = 1, max = 5000000) String shortSummary,
        @Size(min = 1) String fullDescription,
        String bibleBooks,
        String bibleReferences,
        String historicalPeriod,
        String narrativeRole,
        String genealogy,
        String curiosities,
        String importantEvents,
        String keyVerses,
        String keywords
) {
}
