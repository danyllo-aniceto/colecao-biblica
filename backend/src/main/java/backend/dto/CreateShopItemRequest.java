package backend.dto;

import backend.model.ShopItemType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateShopItemRequest(
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Size(max = 2000) String description,
        @NotNull ShopItemType itemType,
        @NotNull @Min(0) Integer priceCoins,
        Long rewardDefinitionId,
        Boolean active
) {
}
