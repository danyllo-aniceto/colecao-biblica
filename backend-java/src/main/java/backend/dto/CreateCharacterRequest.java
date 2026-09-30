package backend.dto;

import backend.model.StickerRarity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCharacterRequest(
        @NotBlank @Size(max = 150) String name,
        String imageUrl,
        @NotNull StickerRarity rarity,
        @NotBlank @Size(max = 5000000) String shortSummary,
        @NotBlank String fullDescription,
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
