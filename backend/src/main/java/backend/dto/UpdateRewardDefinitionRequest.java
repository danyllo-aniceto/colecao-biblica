package backend.dto;

import backend.model.RewardType;
import backend.model.StickerRarity;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpdateRewardDefinitionRequest(
        @Size(min = 1, max = 150) String name,
        RewardType rewardType,
        StickerRarity stickerRarity,
        Long stickerCharacterId,
        @Min(0) Integer coinAmount,
        @Min(0) Integer extraLives,
        @Min(0) Integer extraTimeSeconds,
        @DecimalMin("0.0") Double xpMultiplier,
        @Min(0) Integer ticketAmount,
        @DecimalMin(value = "0.0001") Double dropChance,
        Boolean active
) {
}
