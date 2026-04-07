package backend.dto;

import backend.model.RewardType;
import backend.model.StickerRarity;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateRewardDefinitionRequest(
        @NotBlank String name,
        @NotNull RewardType rewardType,
        StickerRarity stickerRarity,
        Long stickerCharacterId,
        Integer coinAmount,
        Integer extraLives,
        Integer extraTimeSeconds,
        Double xpMultiplier,
        Integer ticketAmount,
        @NotNull @DecimalMin(value = "0.0001") Double dropChance,
        Boolean active
) {
}
