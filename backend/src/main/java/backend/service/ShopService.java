package backend.service;

import backend.dto.CreateShopItemRequest;
import backend.dto.ShopItemResponse;
import backend.dto.UpdateShopItemRequest;
import backend.exception.BadRequestException;
import backend.exception.NotFoundException;
import backend.model.RewardDefinition;
import backend.model.ShopItem;
import backend.model.User;
import backend.repository.RewardDefinitionRepository;
import backend.repository.ShopItemRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

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
        RewardDefinition rewardDefinition = null;
        if (request.rewardDefinitionId() != null) {
            rewardDefinition = rewardDefinitionRepository.findById(request.rewardDefinitionId())
                    .orElseThrow(() -> new NotFoundException("Recompensa da loja não encontrada"));
        }

        ShopItem item = ShopItem.builder()
                .name(request.name())
                .description(request.description())
                .itemType(request.itemType())
                .priceCoins(request.priceCoins())
                .rewardDefinition(rewardDefinition)
                .active(request.active() == null || request.active())
                .build();

        return toResponse(repository.save(item));
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
            item.setRewardDefinition(rewardDefinition);
        }
        if (request.active() != null) {
            item.setActive(request.active());
        }

        return toResponse(repository.save(item));
    }

    public void delete(Long id) {
        ShopItem item = repository.findById(id).orElseThrow(() -> new NotFoundException("Item da loja não encontrado"));
        repository.delete(item);
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
}
