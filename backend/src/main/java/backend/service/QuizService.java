package backend.service;

import backend.dto.QuizMatchResultResponse;
import backend.dto.SubmitQuizMatchRequest;
import backend.exception.BadRequestException;
import backend.model.BiblicalCharacter;
import backend.model.QuestionDifficulty;
import backend.model.QuizMatch;
import backend.model.QuizType;
import backend.model.RewardDefinition;
import backend.model.User;
import backend.repository.QuizMatchRepository;
import backend.repository.QuestionRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

@Service
public class QuizService {

    private final QuizMatchRepository quizMatchRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final RewardService rewardService;
    private final GameSettingService gameSettingService;
    private final CharacterService characterService;
    private final CollectionService collectionService;
    private final QuestionRepository questionRepository;

    public QuizService(QuizMatchRepository quizMatchRepository,
                       UserRepository userRepository,
                       CurrentUserService currentUserService,
                       RewardService rewardService,
                       GameSettingService gameSettingService,
                       CharacterService characterService,
                       CollectionService collectionService,
                       QuestionRepository questionRepository) {
        this.quizMatchRepository = quizMatchRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
        this.rewardService = rewardService;
        this.gameSettingService = gameSettingService;
        this.characterService = characterService;
        this.collectionService = collectionService;
        this.questionRepository = questionRepository;
    }

    public QuizMatchResultResponse submitMatchResult(SubmitQuizMatchRequest request) {
        validateMatchRequest(request);

        User user = currentUserService.getCurrentUser();
        return finalizeMatch(
                user,
                request.quizType(),
                request.questionsAnswered(),
                request.correctAnswers(),
                request.wrongAnswers(),
                request.characterId(),
                1.0,
                null
        );
    }

    public QuizMatchResultResponse finalizeMatch(User user,
                                                 QuizType quizType,
                                                 int questionsAnswered,
                                                 int correctAnswers,
                                                 int wrongAnswers,
                                                 Long characterId,
                                                 double xpMultiplier,
                                                 Instant startedAt) {
        validateMatchStats(quizType, questionsAnswered, correctAnswers, wrongAnswers);

        int xp = calculateXp(correctAnswers, questionsAnswered, xpMultiplier);
        int score = calculateScore(correctAnswers, wrongAnswers);

        if (quizType == QuizType.CHARACTER_STUDY) {
            int percent = gameSettingService.getCharacterStudyXpPercent();
            xp = (xp * percent) / 100;

            if (characterId != null) {
                BiblicalCharacter character = characterService.getById(characterId);
                collectionService.grantStickerIfMissing(user, character);
            }
        }

        user.setXp(user.getXp() + xp);
        user.setTotalScore(user.getTotalScore() + score);
        user.setLevel(calculateLevel(user.getXp()));

        boolean rewardGranted = false;
        String rewardName = null;
        String rewardType = null;
        Long rewardCharacterId = null;
        String rewardCharacterName = null;
        String rewardCharacterRarity = null;
        boolean rewardCharacterUnlocked = false;
        int usedToday;

        int dailyLimit = gameSettingService.getRewardMatchLimitPerDay();
        if (quizType == QuizType.GENERAL) {
            int minimumCorrectForReward = requiredCorrectAnswersForReward(quizType, characterId);
            if (correctAnswers < minimumCorrectForReward) {
                userRepository.save(user);

                QuizMatch match = quizMatchRepository.save(QuizMatch.builder()
                        .user(user)
                        .quizType(quizType)
                        .startedAt(startedAt)
                        .finishedAt(Instant.now())
                        .questionsAnswered(questionsAnswered)
                        .correctAnswers(correctAnswers)
                        .wrongAnswers(wrongAnswers)
                        .xpGained(xp)
                        .scoreGained(score)
                        .rewardGranted(false)
                        .rewardGrantedName(null)
                        .build());

                usedToday = (int) matchesWithRewardToday(user.getId());

                return new QuizMatchResultResponse(
                        match.getId(),
                        xp,
                        score,
                        false,
                        null,
                    null,
                    null,
                    null,
                    null,
                    false,
                        user.getXp(),
                        user.getLevel(),
                        user.getCoins(),
                        usedToday,
                        dailyLimit
                );
            }

            usedToday = (int) matchesWithRewardToday(user.getId());
            if (usedToday < dailyLimit) {
                Optional<RewardDefinition> drawnReward = rewardService.drawRandomActiveReward();
                if (drawnReward.isPresent()) {
                    rewardGranted = true;
                    rewardName = drawnReward.get().getName();
                    RewardService.RewardApplicationResult rewardResult = rewardService.applyRewardToUser(user, drawnReward.get());
                    rewardType = rewardResult.rewardType() != null ? rewardResult.rewardType().name() : null;
                    rewardCharacterId = rewardResult.characterId();
                    rewardCharacterName = rewardResult.characterName();
                    rewardCharacterRarity = rewardResult.characterRarity() != null ? rewardResult.characterRarity().name() : null;
                    rewardCharacterUnlocked = rewardResult.characterUnlocked();
                }
            }
        }

        userRepository.save(user);

        QuizMatch match = quizMatchRepository.save(QuizMatch.builder()
                .user(user)
            .quizType(quizType)
            .startedAt(startedAt)
                .finishedAt(Instant.now())
            .questionsAnswered(questionsAnswered)
            .correctAnswers(correctAnswers)
            .wrongAnswers(wrongAnswers)
                .xpGained(xp)
                .scoreGained(score)
                .rewardGranted(rewardGranted)
                .rewardGrantedName(rewardName)
                .build());

        usedToday = (int) matchesWithRewardToday(user.getId());

        return new QuizMatchResultResponse(
                match.getId(),
                xp,
                score,
                rewardGranted,
                rewardName,
            rewardType,
            rewardCharacterId,
            rewardCharacterName,
            rewardCharacterRarity,
            rewardCharacterUnlocked,
                user.getXp(),
                user.getLevel(),
                user.getCoins(),
                usedToday,
                dailyLimit
        );
    }

    private long matchesWithRewardToday(Long userId) {
        ZoneId zoneId = ZoneId.systemDefault();
        LocalDate now = LocalDate.now(zoneId);
        Instant startOfDay = now.atStartOfDay(zoneId).toInstant();
        Instant endOfDay = now.plusDays(1).atStartOfDay(zoneId).toInstant();

        return quizMatchRepository.countByUserIdAndQuizTypeAndRewardGrantedTrueAndFinishedAtBetween(
                userId,
                QuizType.GENERAL,
                startOfDay,
                endOfDay
        );
    }

    private int requiredCorrectAnswersForReward(QuizType quizType, Long characterId) {
        int availableQuestions;

        if (quizType == QuizType.CHARACTER_STUDY && characterId != null) {
            availableQuestions = questionRepository.findByActiveTrueAndRelatedCharacterId(characterId).size();
        } else {
            availableQuestions = questionRepository.findByActiveTrue().size();
        }

        if (availableQuestions <= 0) {
            return 20;
        }

        return Math.min(20, availableQuestions);
    }

    private int calculateXp(int correctAnswers, int questionsAnswered, double xpMultiplier) {
        int basePerCorrect = 10;
        int difficultyBonus = switch (inferDifficultyByAccuracy(correctAnswers, questionsAnswered)) {
            case EASY -> 0;
            case MEDIUM -> 4;
            case HARD -> 8;
            case VERY_HARD -> 12;
        };

        int baseXp = (correctAnswers * basePerCorrect) + (correctAnswers * difficultyBonus);
        return (int) Math.round(baseXp * xpMultiplier);
    }

    private int calculateScore(int correctAnswers, int wrongAnswers) {
        return (correctAnswers * 100) - (wrongAnswers * 30);
    }

    private QuestionDifficulty inferDifficultyByAccuracy(int correctAnswers, int questionsAnswered) {
        if (questionsAnswered <= 0) {
            return QuestionDifficulty.EASY;
        }

        double accuracy = (double) correctAnswers / questionsAnswered;
        if (accuracy >= 0.90) {
            return QuestionDifficulty.VERY_HARD;
        }
        if (accuracy >= 0.70) {
            return QuestionDifficulty.HARD;
        }
        if (accuracy >= 0.50) {
            return QuestionDifficulty.MEDIUM;
        }
        return QuestionDifficulty.EASY;
    }

    private int calculateLevel(int xp) {
        return (xp / 200) + 1;
    }

    private void validateMatchRequest(SubmitQuizMatchRequest request) {
        validateMatchStats(request.quizType(), request.questionsAnswered(), request.correctAnswers(), request.wrongAnswers());
    }

    private void validateMatchStats(QuizType quizType, int questionsAnswered, int correctAnswers, int wrongAnswers) {
        if (quizType == null) {
            throw new BadRequestException("Tipo de quiz é obrigatório");
        }
        if (questionsAnswered < 0) {
            throw new BadRequestException("Quantidade de perguntas respondidas inválida");
        }
        if (correctAnswers < 0) {
            throw new BadRequestException("Quantidade de acertos inválida");
        }
        if (wrongAnswers < 0) {
            throw new BadRequestException("Quantidade de erros inválida");
        }

        if (correctAnswers + wrongAnswers > questionsAnswered) {
            throw new BadRequestException("Acertos + erros não pode exceder perguntas respondidas");
        }

        if (questionsAnswered > gameSettingService.getMaxQuestionsPerMatch()) {
            throw new BadRequestException("Quantidade de perguntas excede limite configurado");
        }
    }
}
