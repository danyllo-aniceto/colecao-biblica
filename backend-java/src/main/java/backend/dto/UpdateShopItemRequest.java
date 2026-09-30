package backend.dto;

import backend.model.ShopItemType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpdateShopItemRequest(
        @Size(min = 1, max = 150) String name,
        @Size(min = 1, max = 2000) String description,
        ShopItemType itemType,
        @Min(0) Integer priceCoins,
        Long rewardDefinitionId,
        Boolean active
) {
}
