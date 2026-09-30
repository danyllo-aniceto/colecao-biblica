package backend.service;

import backend.dto.ShopPurchaseResponse;
import backend.exception.BadRequestException;
import backend.model.RewardDefinition;
import backend.model.RewardType;
import backend.model.Role;
import backend.model.ShopItem;
import backend.model.ShopItemType;
import backend.model.User;
import backend.repository.RewardDefinitionRepository;
import backend.repository.ShopItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopServicePurchaseTest {

    @Mock
    private ShopItemRepository repository;
    @Mock
    private RewardDefinitionRepository rewardDefinitionRepository;
    @Mock
    private CurrentUserService currentUserService;
    @Mock
    private RewardService rewardService;

    @InjectMocks
    private ShopService service;

    private User user;
    private RewardDefinition extraLife;
    private ShopItem item;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).name("Player").email("p@email.com").password("x").role(Role.USER).coins(500).build();
        extraLife = RewardDefinition.builder().id(3L).name("Vida extra").rewardType(RewardType.EXTRA_LIFE).extraLives(1).dropChance(1.0).build();
        item = ShopItem.builder().id(10L).name("Vida extra").itemType(ShopItemType.GAME_BONUS).priceCoins(180).rewardDefinition(extraLife).active(true).build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(repository.findById(10L)).thenReturn(Optional.of(item));
    }

    @Test
    void purchaseShouldChargeCoinsAndApplyReward() {
        when(rewardService.applyRewardToUser(user, extraLife)).thenAnswer(invocation -> {
            user.setExtraLifeBoosts(user.getExtraLifeBoosts() + 1);
            return new RewardService.RewardApplicationResult(RewardType.EXTRA_LIFE, "Vida extra", null, null, null, false);
        });

        ShopPurchaseResponse response = service.buy(10L);

        assertEquals(320, response.userCoins());
        assertEquals(1, response.extraLifeBoosts());
        assertEquals("EXTRA_LIFE", response.rewardType());
    }

    @Test
    void uselessPurchaseShouldBeRejectedWithoutChargingCoins() {
        doThrow(new BadRequestException("Você já atingiu o limite de vidas extras"))
                .when(rewardService).ensureRewardIsUseful(user, extraLife);

        assertThrows(BadRequestException.class, () -> service.buy(10L));
        assertEquals(500, user.getCoins());
        verify(rewardService, never()).applyRewardToUser(user, extraLife);
    }

    @Test
    void insufficientCoinsShouldBeRejected() {
        user.setCoins(100);

        assertThrows(BadRequestException.class, () -> service.buy(10L));
        verify(rewardService, never()).applyRewardToUser(user, extraLife);
    }
}
