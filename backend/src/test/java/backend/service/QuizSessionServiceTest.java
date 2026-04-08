package backend.service;

import backend.dto.AnswerQuizQuestionRequest;
import backend.dto.AnswerQuizQuestionResponse;
import backend.dto.QuizMatchResultResponse;
import backend.dto.QuizSessionStatusResponse;
import backend.dto.StartQuizSessionRequest;
import backend.model.Question;
import backend.model.QuestionDifficulty;
import backend.model.QuizSession;
import backend.model.QuizSessionStatus;
import backend.model.QuizType;
import backend.model.Role;
import backend.model.User;
import backend.repository.QuestionRepository;
import backend.repository.QuizMatchRepository;
import backend.repository.QuizSessionRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuizSessionServiceTest {

    @Mock
    private QuizSessionRepository quizSessionRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private GameSettingService gameSettingService;

    @Mock
    private CharacterService characterService;

    @Mock
    private QuizService quizService;

    @Mock
    private QuizMatchRepository quizMatchRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private QuizSessionService service;

    @Test
    void startAnswerAndFinishFlowShouldFinalizeMatch() {
        User user = User.builder()
                .id(10L)
                .name("Player")
                .email("player@email.com")
                .password("secret")
                .role(Role.USER)
                .build();

        Question question = Question.builder()
                .id(101L)
                .text("Pergunta?")
                .difficulty(QuestionDifficulty.EASY)
                .timeLimitSeconds(30)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctOption("A")
                .active(true)
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(gameSettingService.getMaxQuestionsPerMatch()).thenReturn(100);
        when(gameSettingService.getStartingLives()).thenReturn(3);
        when(quizSessionRepository.existsByUserIdAndStatus(10L, QuizSessionStatus.IN_PROGRESS)).thenReturn(false);
        when(questionRepository.findByActiveTrue()).thenReturn(List.of(question));

        when(quizSessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> {
            QuizSession session = invocation.getArgument(0);
            if (session.getId() == null) {
                session.setId(1L);
            }
            return session;
        });

        QuizSession inProgress = QuizSession.builder()
                .id(1L)
                .user(user)
                .quizType(QuizType.GENERAL)
                .status(QuizSessionStatus.IN_PROGRESS)
                .startedAt(Instant.now())
                .totalQuestions(1)
                .currentQuestionIndex(0)
                .livesRemaining(3)
                .correctAnswers(0)
                .wrongAnswers(0)
                .xpMultiplier(1.0)
                .questionIdsCsv("101")
                .build();

        when(quizSessionRepository.findByIdAndUserId(1L, 10L)).thenReturn(Optional.of(inProgress));
        when(questionRepository.findById(101L)).thenReturn(Optional.of(question));

        when(quizService.finalizeMatch(any(User.class), any(QuizType.class), anyInt(), anyInt(), anyInt(), any(), anyDouble(), any()))
                .thenReturn(new QuizMatchResultResponse(900L, 20, 100, false, null, 120, 1, 0, 0, 4));

        QuizSessionStatusResponse start = service.startSession(new StartQuizSessionRequest(QuizType.GENERAL, null, 1));

        AnswerQuizQuestionResponse answer = service.answerQuestion(
                start.sessionId(),
                new AnswerQuizQuestionRequest(101L, "A", false, false, false)
        );

        assertTrue(answer.correct());
        assertTrue(answer.finished());
        assertEquals(1, answer.correctAnswers());
        assertEquals(0, answer.wrongAnswers());

        verify(quizService, times(1)).finalizeMatch(any(User.class), any(QuizType.class), anyInt(), anyInt(), anyInt(), any(), anyDouble(), any());
    }

    @Test
    void abandonShouldSetStatusAbandoned() {
        User user = User.builder()
                .id(20L)
                .name("Player")
                .email("player2@email.com")
                .password("secret")
                .role(Role.USER)
                .build();

        QuizSession session = QuizSession.builder()
                .id(2L)
                .user(user)
                .quizType(QuizType.GENERAL)
                .status(QuizSessionStatus.IN_PROGRESS)
                .startedAt(Instant.now())
                .totalQuestions(5)
                .currentQuestionIndex(1)
                .livesRemaining(2)
                .correctAnswers(1)
                .wrongAnswers(0)
                .xpMultiplier(1.0)
                .questionIdsCsv("10,11,12,13,14")
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(quizSessionRepository.findByIdAndUserId(2L, 20L)).thenReturn(Optional.of(session));
        when(quizSessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QuizSessionStatusResponse response = service.abandonSession(2L);

        assertEquals(QuizSessionStatus.ABANDONED, response.status());
        verify(quizSessionRepository, times(1)).save(any(QuizSession.class));
    }

    @Test
    void getActiveSessionShouldReturnCurrentQuestion() {
        User user = User.builder()
                .id(30L)
                .name("Player")
                .email("active@email.com")
                .password("secret")
                .role(Role.USER)
                .build();

        Question question = Question.builder()
                .id(500L)
                .text("Ativa?")
                .difficulty(QuestionDifficulty.EASY)
                .timeLimitSeconds(30)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctOption("A")
                .active(true)
                .build();

        QuizSession session = QuizSession.builder()
                .id(50L)
                .user(user)
                .quizType(QuizType.GENERAL)
                .status(QuizSessionStatus.IN_PROGRESS)
                .startedAt(Instant.now())
                .totalQuestions(1)
                .currentQuestionIndex(0)
                .livesRemaining(3)
                .correctAnswers(0)
                .wrongAnswers(0)
                .xpMultiplier(1.0)
                .questionIdsCsv("500")
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(quizSessionRepository.findFirstByUserIdAndStatusOrderByStartedAtDesc(30L, QuizSessionStatus.IN_PROGRESS))
                .thenReturn(Optional.of(session));
        when(questionRepository.findById(500L)).thenReturn(Optional.of(question));

        QuizSessionStatusResponse response = service.getActiveSession();

        assertEquals(50L, response.sessionId());
        assertNotNull(response.currentQuestion());
        assertEquals(500L, response.currentQuestion().id());
    }

    @Test
    void extraLifeOnCorrectAnswerShouldNotSpendTicket() {
        User user = User.builder()
                .id(40L)
                .name("Player")
                .email("tickets@email.com")
                .password("secret")
                .role(Role.USER)
                .build();

        Question question = Question.builder()
                .id(700L)
                .text("Correta")
                .difficulty(QuestionDifficulty.EASY)
                .timeLimitSeconds(30)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctOption("A")
                .active(true)
                .build();

        QuizSession inProgress = QuizSession.builder()
                .id(70L)
                .user(user)
                .quizType(QuizType.GENERAL)
                .status(QuizSessionStatus.IN_PROGRESS)
                .startedAt(Instant.now())
                .totalQuestions(2)
                .currentQuestionIndex(0)
                .livesRemaining(3)
                .correctAnswers(0)
                .wrongAnswers(0)
                .xpMultiplier(1.0)
                .questionIdsCsv("700,701")
                .build();

        Question next = Question.builder()
                .id(701L)
                .text("Próxima")
                .difficulty(QuestionDifficulty.EASY)
                .timeLimitSeconds(30)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctOption("A")
                .active(true)
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(quizSessionRepository.findByIdAndUserId(70L, 40L)).thenReturn(Optional.of(inProgress));
        when(questionRepository.findById(700L)).thenReturn(Optional.of(question));
        when(questionRepository.findById(701L)).thenReturn(Optional.of(next));
        when(quizSessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AnswerQuizQuestionResponse response = service.answerQuestion(
                70L,
                new AnswerQuizQuestionRequest(700L, "A", false, true, false)
        );

        assertTrue(response.correct());
        verify(userRepository, never()).save(any(User.class));
    }
}
