package backend.dto;

import backend.model.ShopItemType;

public record ShopItemResponse(
        Long id,
        String name,
        String description,
        ShopItemType itemType,
        int priceCoins,
        Long rewardDefinitionId,
        String rewardName,
        boolean active
) {
}
