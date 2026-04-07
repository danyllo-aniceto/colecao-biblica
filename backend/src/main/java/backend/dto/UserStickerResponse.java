package backend.dto;

import backend.model.StickerRarity;

import java.time.Instant;

public record UserStickerResponse(
        Long characterId,
        String characterName,
        String imageUrl,
        StickerRarity rarity,
        Instant acquiredAt
) {
}
