package backend.service;

import backend.dto.QuizMatchResultResponse;
import backend.model.BiblicalCharacter;
import backend.model.QuizMatch;
import backend.model.QuizType;
import backend.model.RewardDefinition;
import backend.model.RewardType;
import backend.model.Role;
import backend.model.StickerRarity;
import backend.model.User;
import backend.repository.QuestionRepository;
import backend.repository.QuizMatchRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class QuizServiceRulesTest {

    @Mock
    private QuizMatchRepository quizMatchRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private CurrentUserService currentUserService;
    @Mock
    private RewardService rewardService;
    @Mock
    private GameSettingService gameSettingService;
    @Mock
    private CharacterService characterService;
    @Mock
    private CollectionService collectionService;
    @Mock
    private QuestionRepository questionRepository;

    private QuizService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new QuizService(quizMatchRepository, userRepository, currentUserService, rewardService,
                gameSettingService, characterService, collectionService, questionRepository, "America/Sao_Paulo");

        user = User.builder().id(1L).name("Player").email("p@email.com").password("x").role(Role.USER).build();

        when(gameSettingService.getMaxQuestionsPerMatch()).thenReturn(100);
        when(gameSettingService.getRewardMatchLimitPerDay()).thenReturn(4);
        when(gameSettingService.getRewardMinCorrectAnswers()).thenReturn(7);
        when(gameSettingService.getCharacterStudyXpPercent()).thenReturn(35);
        when(gameSettingService.getCharacterStickerMinAccuracyPercent()).thenReturn(70);
        when(questionRepository.countByActiveTrue()).thenReturn(50L);
        when(quizMatchRepository.save(any(QuizMatch.class))).thenAnswer(invocation -> {
            QuizMatch match = invocation.getArgument(0);
            match.setId(99L);
            return match;
        });
    }

    @Test
    void generalQuizWithEnoughCorrectAnswersShouldDrawReward() {
        RewardDefinition coins = RewardDefinition.builder().name("Moedas").rewardType(RewardType.COINS).coinAmount(50).dropChance(1.0).build();
        when(rewardService.drawRandomActiveReward()).thenReturn(Optional.of(coins));
        when(rewardService.applyRewardToUser(user, coins)).thenReturn(
                new RewardService.RewardApplicationResult(RewardType.COINS, "Moedas", null, null, null, false));

        QuizMatchResultResponse result = service.finalizeMatch(user, QuizType.GENERAL, 10, 7, 3, null, 1.0, Instant.now());

        assertTrue(result.rewardGranted());
        assertEquals("Moedas", result.rewardName());
    }

    @Test
    void generalQuizBelowMinimumShouldNotDrawReward() {
        QuizMatchResultResponse result = service.finalizeMatch(user, QuizType.GENERAL, 10, 6, 4, null, 1.0, Instant.now());

        assertFalse(result.rewardGranted());
        verify(rewardService, never()).drawRandomActiveReward();
    }

    @Test
    void minimumIsCappedBySmallQuestionBank() {
        when(questionRepository.countByActiveTrue()).thenReturn(3L);

        assertEquals(3, service.requiredCorrectAnswersForReward());
    }

    @Test
    void characterStudyWithLowAccuracyShouldNotGrantSticker() {
        QuizMatchResultResponse result = service.finalizeMatch(user, QuizType.CHARACTER_STUDY, 10, 5, 5, 7L, 1.0, Instant.now());

        assertFalse(result.rewardCharacterUnlocked());
        verify(collectionService, never()).grantStickerIfMissing(any(), any());
    }

    @Test
    void characterStudyWithGoodAccuracyShouldGrantSticker() {
        BiblicalCharacter davi = BiblicalCharacter.builder().id(7L).name("Davi").rarity(StickerRarity.RARE).build();
        when(characterService.getById(7L)).thenReturn(davi);
        when(collectionService.grantStickerIfMissing(eq(user), eq(davi))).thenReturn(true);

        QuizMatchResultResponse result = service.finalizeMatch(user, QuizType.CHARACTER_STUDY, 10, 7, 3, 7L, 1.0, Instant.now());

        assertTrue(result.rewardCharacterUnlocked());
        assertEquals("Davi", result.rewardCharacterName());
        assertFalse(result.rewardGranted());
        verify(quizMatchRepository, never()).countByUserIdAndQuizTypeAndRewardGrantedTrueAndFinishedAtBetween(anyLong(), eq(QuizType.CHARACTER_STUDY), any(), any());
    }
}
