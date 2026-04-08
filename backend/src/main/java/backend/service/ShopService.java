package backend.service;

import backend.dto.CreateShopItemRequest;
import backend.dto.ShopItemResponse;
import backend.dto.UpdateShopItemRequest;
import backend.exception.BadRequestException;
import backend.exception.NotFoundException;
import backend.model.RewardDefinition;
import backend.model.RewardType;
import backend.model.ShopItem;
import backend.model.ShopItemType;
import backend.model.StickerRarity;
import backend.model.User;
import backend.repository.RewardDefinitionRepository;
import backend.repository.ShopItemRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ShopService {

    private final ShopItemRepository repository;
    private final RewardDefinitionRepository rewardDefinitionRepository;
    private final CurrentUserService currentUserService;
    private final RewardService rewardService;
    private final UserRepository userRepository;

    public ShopService(ShopItemRepository repository,
                       RewardDefinitionRepository rewardDefinitionRepository,
                       CurrentUserService currentUserService,
                       RewardService rewardService,
                       UserRepository userRepository) {
        this.repository = repository;
        this.rewardDefinitionRepository = rewardDefinitionRepository;
        this.currentUserService = currentUserService;
        this.rewardService = rewardService;
        this.userRepository = userRepository;
    }

    public ShopItemResponse create(CreateShopItemRequest request) {
        throw new BadRequestException("Os itens da loja são fixos do sistema e não podem ser criados");
    }

    public List<ShopItemResponse> listActiveItems() {
        return repository.findByActiveTrueOrderByPriceCoinsAsc().stream().map(this::toResponse).toList();
    }

    public ShopItemResponse update(Long id, UpdateShopItemRequest request) {
        ShopItem item = repository.findById(id).orElseThrow(() -> new NotFoundException("Item da loja não encontrado"));

        if (request.name() != null) {
            item.setName(request.name());
        }
        if (request.description() != null) {
            item.setDescription(request.description());
        }
        if (request.itemType() != null) {
            item.setItemType(request.itemType());
        }
        if (request.priceCoins() != null) {
            item.setPriceCoins(request.priceCoins());
        }
        if (request.rewardDefinitionId() != null) {
            RewardDefinition rewardDefinition = rewardDefinitionRepository.findById(request.rewardDefinitionId())
                    .orElseThrow(() -> new NotFoundException("Recompensa da loja não encontrada"));
            validateShopReward(rewardDefinition);
            item.setRewardDefinition(rewardDefinition);
        }
        if (request.active() != null) {
            item.setActive(request.active());
        }

        return toResponse(repository.save(item));
    }

    public void delete(Long id) {
        throw new BadRequestException("Os itens da loja são fixos do sistema e não podem ser removidos");
    }

    public ShopItemResponse buy(Long shopItemId) {
        User user = currentUserService.getCurrentUser();
        ShopItem item = repository.findById(shopItemId).orElseThrow(() -> new NotFoundException("Item da loja não encontrado"));

        if (!item.isActive()) {
            throw new BadRequestException("Item da loja inativo");
        }

        if (user.getCoins() < item.getPriceCoins()) {
            throw new BadRequestException("Moedas insuficientes");
        }

        user.setCoins(user.getCoins() - item.getPriceCoins());
        userRepository.save(user);

        if (item.getRewardDefinition() != null) {
            validateShopReward(item.getRewardDefinition());
            rewardService.applyRewardToUser(user, item.getRewardDefinition());
        }

        return toResponse(item);
    }

    public ShopItemResponse toResponse(ShopItem item) {
        return new ShopItemResponse(
                item.getId(),
                item.getName(),
                item.getDescription(),
                item.getItemType(),
                item.getPriceCoins(),
                item.getRewardDefinition() != null ? item.getRewardDefinition().getId() : null,
                item.getRewardDefinition() != null ? item.getRewardDefinition().getName() : null,
                item.isActive()
        );
    }

    public void ensureFixedShopItems() {
        Map<String, RewardDefinition> rewardsByName = rewardDefinitionRepository.findAll().stream()
                .collect(Collectors.toMap(item -> item.getName().toLowerCase(Locale.ROOT), Function.identity(), (first, second) -> first));

        ensureFixedShopItem("Figurinha Comum", "Compra uma figurinha comum aleatória", ShopItemType.STICKER, 120, rewardsByName.get("figurinha comum"), true);
        ensureFixedShopItem("Figurinha Rara", "Compra uma figurinha rara aleatória", ShopItemType.STICKER, 260, rewardsByName.get("figurinha rara"), true);
        ensureFixedShopItem("Figurinha Épica", "Compra uma figurinha épica aleatória", ShopItemType.STICKER, 450, rewardsByName.get("figurinha épica"), true);
        ensureFixedShopItem("XP em dobro", "Ativa um multiplicador de XP para a próxima partida", ShopItemType.GAME_BONUS, 220, rewardsByName.get("xp em dobro"), true);
        ensureFixedShopItem("Vida extra", "Adiciona uma vida extra consumível", ShopItemType.GAME_BONUS, 180, rewardsByName.get("vida extra"), true);
        ensureFixedShopItem("Tempo extra", "Adiciona tempo extra consumível", ShopItemType.GAME_BONUS, 150, rewardsByName.get("tempo extra"), true);

        Set<String> fixedNames = new HashSet<>(Arrays.asList(
                "figurinha comum",
                "figurinha rara",
                "figurinha épica",
                "xp em dobro",
                "vida extra",
                "tempo extra"
        ));

        repository.findAll().stream()
                .filter(item -> !fixedNames.contains(item.getName().toLowerCase(Locale.ROOT)))
                .forEach(item -> {
                    item.setActive(false);
                    repository.save(item);
                });
    }

    private void ensureFixedShopItem(String name,
                                     String description,
                                     ShopItemType itemType,
                                     int priceCoins,
                                     RewardDefinition reward,
                                     boolean active) {
        ShopItem item = repository.findAll().stream()
                .filter(current -> current.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElse(ShopItem.builder().name(name).build());

        if (reward != null) {
            validateShopReward(reward);
        }

        item.setDescription(description);
        item.setItemType(itemType);
        item.setPriceCoins(priceCoins);
        item.setRewardDefinition(reward);
        item.setActive(active);

        repository.save(item);
    }

    private void validateShopReward(RewardDefinition rewardDefinition) {
        if (rewardDefinition.getRewardType() == RewardType.COINS) {
            throw new BadRequestException("Itens de loja não podem conceder moedas");
        }

        if (rewardDefinition.getRewardType() == RewardType.STICKER && rewardDefinition.getStickerRarity() == StickerRarity.LEGENDARY) {
            throw new BadRequestException("Figurinhas lendárias não podem ser compradas na loja");
        }
    }
}
