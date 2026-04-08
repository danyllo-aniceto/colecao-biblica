package backend.service;

import backend.dto.CreateRewardDefinitionRequest;
import backend.dto.RewardDefinitionResponse;
import backend.dto.UpdateRewardDefinitionRequest;
import backend.exception.BadRequestException;
import backend.model.BiblicalCharacter;
import backend.model.RewardDefinition;
import backend.model.RewardType;
import backend.model.StickerRarity;
import backend.model.User;
import backend.model.UserSticker;
import backend.repository.BiblicalCharacterRepository;
import backend.repository.RewardDefinitionRepository;
import backend.repository.UserRepository;
import backend.repository.UserStickerRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class RewardService {

    private final RewardDefinitionRepository repository;
    private final CharacterService characterService;
    private final BiblicalCharacterRepository characterRepository;
    private final UserRepository userRepository;
    private final UserStickerRepository userStickerRepository;
    private final GameSettingService gameSettingService;

    public RewardService(RewardDefinitionRepository repository,
                         CharacterService characterService,
                         BiblicalCharacterRepository characterRepository,
                         UserRepository userRepository,
                         UserStickerRepository userStickerRepository,
                         GameSettingService gameSettingService) {
        this.repository = repository;
        this.characterService = characterService;
        this.characterRepository = characterRepository;
        this.userRepository = userRepository;
        this.userStickerRepository = userStickerRepository;
        this.gameSettingService = gameSettingService;
    }

    public RewardDefinitionResponse create(CreateRewardDefinitionRequest request) {
        throw new BadRequestException("As recompensas são fixas do sistema. Apenas probabilidade e configuração podem ser alteradas");
    }

    public List<RewardDefinitionResponse> listAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public RewardDefinitionResponse update(Long id, UpdateRewardDefinitionRequest request) {
        RewardDefinition reward = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Recompensa não encontrada"));

        // Recompensas fixas: não permitimos alterar identidade da recompensa.
        if (request.coinAmount() != null) {
            reward.setCoinAmount(request.coinAmount());
        }
        if (request.extraLives() != null) {
            reward.setExtraLives(request.extraLives());
        }
        if (request.extraTimeSeconds() != null) {
            reward.setExtraTimeSeconds(request.extraTimeSeconds());
        }
        if (request.xpMultiplier() != null) {
            reward.setXpMultiplier(request.xpMultiplier());
        }
        if (request.dropChance() != null) {
            validateDropChance(request.dropChance());
            reward.setDropChance(request.dropChance());
        }
        if (request.active() != null) {
            reward.setActive(request.active());
        }

        return toResponse(repository.save(reward));
    }

    public void delete(Long id) {
        throw new BadRequestException("As recompensas são fixas do sistema e não podem ser removidas");
    }

    public Optional<RewardDefinition> drawRandomActiveReward() {
        List<RewardDefinition> rewards = repository.findByActiveTrue();
        if (rewards.isEmpty()) {
            return Optional.empty();
        }

        double totalWeight = rewards.stream().mapToDouble(RewardDefinition::getDropChance).sum();
        if (totalWeight <= 0) {
            return Optional.empty();
        }

        double randomWeight = ThreadLocalRandom.current().nextDouble(totalWeight);
        double accumulator = 0;

        for (RewardDefinition reward : rewards) {
            accumulator += reward.getDropChance();
            if (randomWeight <= accumulator) {
                return Optional.of(reward);
            }
        }

        return Optional.of(rewards.getLast());
    }

    public void applyRewardToUser(User user, RewardDefinition reward) {
        switch (reward.getRewardType()) {
            case COINS -> user.setCoins(user.getCoins() + defaultZero(reward.getCoinAmount()));
            case STICKER -> applyStickerReward(user, reward);
            case EXTRA_LIFE -> user.setExtraLifeBoosts(
                Math.min(user.getExtraLifeBoosts() + Math.max(defaultZero(reward.getExtraLives()), 1), gameSettingService.getMaxExtraLifeBoosts())
            );
            case EXTRA_TIME -> user.setExtraTimeBoosts(
                Math.min(user.getExtraTimeBoosts() + Math.max(defaultZero(reward.getExtraTimeSeconds()), 1), gameSettingService.getMaxExtraTimeBoosts())
            );
            case XP_MULTIPLIER -> user.setDoubleXpBoosts(
                Math.min(user.getDoubleXpBoosts() + 1, gameSettingService.getMaxDoubleXpBoosts())
            );
        }

        userRepository.save(user);
    }

    public RewardDefinitionResponse toResponse(RewardDefinition reward) {
        return new RewardDefinitionResponse(
                reward.getId(),
                reward.getName(),
                reward.getRewardType(),
                reward.getStickerRarity(),
                reward.getStickerCharacter() != null ? reward.getStickerCharacter().getId() : null,
                reward.getStickerCharacter() != null ? reward.getStickerCharacter().getName() : null,
                reward.getCoinAmount(),
                reward.getExtraLives(),
                reward.getExtraTimeSeconds(),
                reward.getXpMultiplier(),
                reward.getDropChance(),
                reward.isActive()
        );
    }

    private void applyStickerReward(User user, RewardDefinition reward) {
        BiblicalCharacter character = reward.getStickerCharacter();

        if (character == null && reward.getStickerRarity() != null) {
            List<BiblicalCharacter> byRarity = new ArrayList<>(characterRepository.findByRarity(reward.getStickerRarity()));
            byRarity.sort(Comparator.comparing(BiblicalCharacter::getId));
            if (!byRarity.isEmpty()) {
                character = byRarity.get(ThreadLocalRandom.current().nextInt(byRarity.size()));
            }
        }

        if (character == null) {
            throw new BadRequestException("Recompensa de figurinha precisa de raridade ou personagem vinculado");
        }

        final BiblicalCharacter selectedCharacter = character;

        userStickerRepository.findByUserIdAndCharacterId(user.getId(), selectedCharacter.getId()).orElseGet(() ->
                userStickerRepository.save(UserSticker.builder()
                        .user(user)
                        .character(selectedCharacter)
                        .acquiredAt(Instant.now())
                        .build())
        );
    }

    private void validateDropChance(Double dropChance) {
        if (dropChance == null || dropChance <= 0) {
            throw new BadRequestException("Chance de drop deve ser maior que zero");
        }
    }

    private int defaultZero(Integer value) {
        return value == null ? 0 : value;
    }

    public void ensureFixedRewards() {
        ensureFixedReward("Figurinha Comum", RewardType.STICKER, StickerRarity.COMMON, null, 0, 0, 0, 1.0, 35.0, true);
        ensureFixedReward("Figurinha Rara", RewardType.STICKER, StickerRarity.RARE, null, 0, 0, 0, 1.0, 20.0, true);
        ensureFixedReward("Figurinha Épica", RewardType.STICKER, StickerRarity.EPIC, null, 0, 0, 0, 1.0, 10.0, true);
        ensureFixedReward("Figurinha Lendária", RewardType.STICKER, StickerRarity.LEGENDARY, null, 0, 0, 0, 1.0, 5.0, true);
        ensureFixedReward("Moedas", RewardType.COINS, null, null, 50, 0, 0, 1.0, 20.0, true);
        ensureFixedReward("XP em dobro", RewardType.XP_MULTIPLIER, null, null, 0, 0, 0, 2.0, 5.0, true);
        ensureFixedReward("Vida extra", RewardType.EXTRA_LIFE, null, null, 0, 1, 0, 1.0, 3.0, true);
        ensureFixedReward("Tempo extra", RewardType.EXTRA_TIME, null, null, 0, 0, 1, 1.0, 2.0, true);
    }

    private void ensureFixedReward(String name,
                                   RewardType type,
                                   StickerRarity rarity,
                                   BiblicalCharacter character,
                                   int coinAmount,
                                   int extraLives,
                                   int extraTimeSeconds,
                                   double xpMultiplier,
                                   double dropChance,
                                   boolean active) {
        RewardDefinition reward = repository.findAll().stream()
                .filter(item -> item.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElse(RewardDefinition.builder().name(name).build());

        reward.setRewardType(type);
        reward.setStickerRarity(rarity);
        reward.setStickerCharacter(character);
        reward.setCoinAmount(coinAmount);
        reward.setExtraLives(extraLives);
        reward.setExtraTimeSeconds(extraTimeSeconds);
        reward.setXpMultiplier(xpMultiplier);
        reward.setDropChance(dropChance);
        reward.setActive(active);

        repository.save(reward);
    }
}
