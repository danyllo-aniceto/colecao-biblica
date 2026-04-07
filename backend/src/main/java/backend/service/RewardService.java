package backend.service;

import backend.dto.CreateRewardDefinitionRequest;
import backend.dto.RewardDefinitionResponse;
import backend.dto.UpdateRewardDefinitionRequest;
import backend.exception.BadRequestException;
import backend.model.BiblicalCharacter;
import backend.model.RewardDefinition;
import backend.model.User;
import backend.model.UserSticker;
import backend.repository.RewardDefinitionRepository;
import backend.repository.UserRepository;
import backend.repository.UserStickerRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class RewardService {

    private final RewardDefinitionRepository repository;
    private final CharacterService characterService;
    private final UserRepository userRepository;
    private final UserStickerRepository userStickerRepository;

    public RewardService(RewardDefinitionRepository repository,
                         CharacterService characterService,
                         UserRepository userRepository,
                         UserStickerRepository userStickerRepository) {
        this.repository = repository;
        this.characterService = characterService;
        this.userRepository = userRepository;
        this.userStickerRepository = userStickerRepository;
    }

    public RewardDefinitionResponse create(CreateRewardDefinitionRequest request) {
        validateDropChance(request.dropChance());

        BiblicalCharacter stickerCharacter = null;
        if (request.stickerCharacterId() != null) {
            stickerCharacter = characterService.getById(request.stickerCharacterId());
        }

        RewardDefinition rewardDefinition = RewardDefinition.builder()
                .name(request.name())
                .rewardType(request.rewardType())
                .stickerRarity(request.stickerRarity())
                .stickerCharacter(stickerCharacter)
                .coinAmount(defaultZero(request.coinAmount()))
                .extraLives(defaultZero(request.extraLives()))
                .extraTimeSeconds(defaultZero(request.extraTimeSeconds()))
                .xpMultiplier(request.xpMultiplier() != null ? request.xpMultiplier() : 1.0)
                .ticketAmount(defaultZero(request.ticketAmount()))
                .dropChance(request.dropChance())
                .active(request.active() == null || request.active())
                .build();

        return toResponse(repository.save(rewardDefinition));
    }

    public List<RewardDefinitionResponse> listAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public RewardDefinitionResponse update(Long id, UpdateRewardDefinitionRequest request) {
        RewardDefinition reward = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Recompensa não encontrada"));

        if (request.name() != null) {
            reward.setName(request.name());
        }
        if (request.rewardType() != null) {
            reward.setRewardType(request.rewardType());
        }
        if (request.stickerRarity() != null) {
            reward.setStickerRarity(request.stickerRarity());
        }
        if (request.stickerCharacterId() != null) {
            reward.setStickerCharacter(characterService.getById(request.stickerCharacterId()));
        }
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
        if (request.ticketAmount() != null) {
            reward.setTicketAmount(request.ticketAmount());
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
        RewardDefinition reward = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Recompensa não encontrada"));
        repository.delete(reward);
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
            case REWARD_TICKET -> user.setRewardTickets(user.getRewardTickets() + defaultZero(reward.getTicketAmount()));
            case EXTRA_LIFE, EXTRA_TIME, XP_MULTIPLIER -> {
                user.setRewardTickets(user.getRewardTickets() + 1);
            }
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
                reward.getTicketAmount(),
                reward.getDropChance(),
                reward.isActive()
        );
    }

    private void applyStickerReward(User user, RewardDefinition reward) {
        BiblicalCharacter character = reward.getStickerCharacter();
        if (character == null) {
            throw new BadRequestException("Recompensa de figurinha precisa de um personagem vinculado");
        }

        userStickerRepository.findByUserIdAndCharacterId(user.getId(), character.getId()).orElseGet(() ->
                userStickerRepository.save(UserSticker.builder()
                        .user(user)
                        .character(character)
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
}
