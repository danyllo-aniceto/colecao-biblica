package backend.dto;

import backend.model.RewardType;
import backend.model.StickerRarity;

public record RewardDefinitionResponse(
        Long id,
        String name,
        RewardType rewardType,
        StickerRarity stickerRarity,
        Long stickerCharacterId,
        String stickerCharacterName,
        Integer coinAmount,
        Integer extraLives,
        Integer extraTimeSeconds,
        Double xpMultiplier,
        Double dropChance,
        boolean active
) {
}
