package backend.dto;

public record ShopPurchaseResponse(
        ShopItemResponse item,
        String rewardType,
        Long characterId,
        String characterName,
        String characterRarity,
        boolean characterUnlocked,
        int userCoins,
        int extraLifeBoosts,
        int extraTimeBoosts,
        int doubleXpBoosts
) {
}
