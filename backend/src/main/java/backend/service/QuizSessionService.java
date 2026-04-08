package backend.service;

import backend.dto.AnswerQuizQuestionRequest;
import backend.dto.AnswerQuizQuestionResponse;
import backend.dto.QuizHistoryResponse;
import backend.dto.QuizMatchHistoryItemResponse;
import backend.dto.QuizMatchResultResponse;
import backend.dto.QuizQuestionViewResponse;
import backend.dto.QuizSessionHistoryItemResponse;
import backend.dto.QuizSessionStatusResponse;
import backend.dto.StartQuizSessionRequest;
import backend.exception.BadRequestException;
import backend.exception.NotFoundException;
import backend.model.BiblicalCharacter;
import backend.model.Question;
import backend.model.QuizMatch;
import backend.model.QuizSession;
import backend.model.QuizSessionStatus;
import backend.model.QuizType;
import backend.model.User;
import backend.repository.QuestionRepository;
import backend.repository.QuizMatchRepository;
import backend.repository.QuizSessionRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class QuizSessionService {

    private final QuizSessionRepository quizSessionRepository;
    private final QuestionRepository questionRepository;
    private final CurrentUserService currentUserService;
    private final GameSettingService gameSettingService;
    private final CharacterService characterService;
    private final QuizService quizService;
    private final QuizMatchRepository quizMatchRepository;
    private final UserRepository userRepository;

    public QuizSessionService(QuizSessionRepository quizSessionRepository,
                              QuestionRepository questionRepository,
                              CurrentUserService currentUserService,
                              GameSettingService gameSettingService,
                              CharacterService characterService,
                              QuizService quizService,
                              QuizMatchRepository quizMatchRepository,
                              UserRepository userRepository) {
        this.quizSessionRepository = quizSessionRepository;
        this.questionRepository = questionRepository;
        this.currentUserService = currentUserService;
        this.gameSettingService = gameSettingService;
        this.characterService = characterService;
        this.quizService = quizService;
        this.quizMatchRepository = quizMatchRepository;
        this.userRepository = userRepository;
    }

    public QuizSessionStatusResponse startSession(StartQuizSessionRequest request) {
        User user = currentUserService.getCurrentUser();

        if (quizSessionRepository.existsByUserIdAndStatus(user.getId(), QuizSessionStatus.IN_PROGRESS)) {
            throw new BadRequestException("Já existe uma sessão de quiz em andamento para este usuário");
        }

        int maxQuestions = gameSettingService.getMaxQuestionsPerMatch();
        int requested = request.questionLimit() != null ? request.questionLimit() : Math.min(10, maxQuestions);
        int questionLimit = Math.max(1, Math.min(requested, maxQuestions));

        BiblicalCharacter character = null;
        List<Question> questions;

        if (request.quizType() == QuizType.CHARACTER_STUDY) {
            if (request.characterId() == null) {
                throw new BadRequestException("characterId é obrigatório no quiz de personagem");
            }
            character = characterService.getById(request.characterId());
            questions = questionRepository.findByActiveTrueAndRelatedCharacterId(character.getId());
        } else {
            questions = questionRepository.findByActiveTrue();
        }

        if (questions.isEmpty()) {
            throw new BadRequestException("Não há perguntas disponíveis para iniciar a sessão");
        }

        Collections.shuffle(questions);
        List<Question> selected = questions.stream().limit(questionLimit).toList();
        String questionIdsCsv = selected.stream().map(q -> q.getId().toString()).collect(Collectors.joining(","));

        QuizSession session = quizSessionRepository.save(QuizSession.builder()
                .user(user)
                .quizType(request.quizType())
                .character(character)
                .status(QuizSessionStatus.IN_PROGRESS)
                .startedAt(Instant.now())
                .totalQuestions(selected.size())
                .currentQuestionIndex(0)
                .livesRemaining(gameSettingService.getStartingLives())
                .correctAnswers(0)
                .wrongAnswers(0)
                .xpMultiplier(1.0)
                .questionIdsCsv(questionIdsCsv)
                .build());

        return toStatusResponse(session, selected.getFirst());
    }

    public QuizSessionStatusResponse getSessionStatus(Long sessionId) {
        User user = currentUserService.getCurrentUser();
        QuizSession session = getOwnedSession(sessionId, user.getId());

        Question currentQuestion = null;
        if (session.getStatus() == QuizSessionStatus.IN_PROGRESS) {
            currentQuestion = getCurrentQuestion(session);
        }

        return toStatusResponse(session, currentQuestion);
    }

    public QuizSessionStatusResponse getActiveSession() {
        User user = currentUserService.getCurrentUser();
        QuizSession session = quizSessionRepository.findFirstByUserIdAndStatusOrderByStartedAtDesc(user.getId(), QuizSessionStatus.IN_PROGRESS)
                .orElseThrow(() -> new NotFoundException("Nenhuma sessão ativa encontrada"));

        Question currentQuestion = getCurrentQuestion(session);
        return toStatusResponse(session, currentQuestion);
    }

    public AnswerQuizQuestionResponse answerQuestion(Long sessionId, AnswerQuizQuestionRequest request) {
        User user = currentUserService.getCurrentUser();
        QuizSession session = getOwnedSession(sessionId, user.getId());

        if (session.getStatus() != QuizSessionStatus.IN_PROGRESS) {
            throw new BadRequestException("Sessão de quiz já finalizada");
        }

        Question currentQuestion = getCurrentQuestion(session);
        if (!currentQuestion.getId().equals(request.questionId())) {
            throw new BadRequestException("A pergunta informada não corresponde à pergunta atual da sessão");
        }

        boolean correct = currentQuestion.getCorrectOption().equalsIgnoreCase(request.selectedOption());
        boolean extraLifeApplied = applyConsumables(user, session, request, correct);

        if (correct) {
            session.setCorrectAnswers(session.getCorrectAnswers() + 1);
        } else {
            session.setWrongAnswers(session.getWrongAnswers() + 1);
            if (!extraLifeApplied) {
                session.setLivesRemaining(session.getLivesRemaining() - 1);
            }
        }

        session.setCurrentQuestionIndex(session.getCurrentQuestionIndex() + 1);

        boolean finished = session.getLivesRemaining() <= 0 || session.getCurrentQuestionIndex() >= session.getTotalQuestions();
        if (finished) {
            session.setStatus(QuizSessionStatus.FINISHED);
            session.setFinishedAt(Instant.now());
            quizSessionRepository.save(session);

            QuizMatchResultResponse result = quizService.finalizeMatch(
                    user,
                    session.getQuizType(),
                    session.getCurrentQuestionIndex(),
                    session.getCorrectAnswers(),
                    session.getWrongAnswers(),
                    session.getCharacter() != null ? session.getCharacter().getId() : null,
                    session.getXpMultiplier(),
                    session.getStartedAt()
            );

            return new AnswerQuizQuestionResponse(
                    correct,
                    Math.max(session.getLivesRemaining(), 0),
                    session.getCorrectAnswers(),
                    session.getWrongAnswers(),
                    true,
                    null,
                    result
            );
        }

        quizSessionRepository.save(session);
        Question nextQuestion = getCurrentQuestion(session);

        return new AnswerQuizQuestionResponse(
                correct,
                session.getLivesRemaining(),
                session.getCorrectAnswers(),
                session.getWrongAnswers(),
                false,
                toQuestionView(nextQuestion),
                null
        );
    }

    public QuizSessionStatusResponse abandonSession(Long sessionId) {
        User user = currentUserService.getCurrentUser();
        QuizSession session = getOwnedSession(sessionId, user.getId());

        if (session.getStatus() != QuizSessionStatus.IN_PROGRESS) {
            throw new BadRequestException("Apenas sessões em andamento podem ser abandonadas");
        }

        session.setStatus(QuizSessionStatus.ABANDONED);
        session.setFinishedAt(Instant.now());
        quizSessionRepository.save(session);

        return toStatusResponse(session, null);
    }

    public QuizHistoryResponse getMyHistory(int limit) {
        User user = currentUserService.getCurrentUser();
        int safeLimit = Math.max(1, Math.min(limit, 100));

        List<QuizSessionHistoryItemResponse> sessions = quizSessionRepository.findByUserIdOrderByStartedAtDesc(user.getId())
                .stream()
                .limit(safeLimit)
                .map(this::toSessionHistory)
                .toList();

        List<QuizMatchHistoryItemResponse> matches = quizMatchRepository.findByUserIdOrderByFinishedAtDesc(user.getId())
                .stream()
                .limit(safeLimit)
                .map(this::toMatchHistory)
                .toList();

        return new QuizHistoryResponse(sessions, matches);
    }

    private boolean applyConsumables(User user, QuizSession session, AnswerQuizQuestionRequest request, boolean answerCorrect) {
        boolean extraLifeApplied = false;
        boolean hasChanges = false;

        if (Boolean.TRUE.equals(request.useExtraTime())) {
            if (session.isExtraTimeUsed()) {
                throw new BadRequestException("Bônus de tempo extra já foi usado nesta partida");
            }
            if (user.getExtraTimeBoosts() <= 0) {
                throw new BadRequestException("Você não possui bônus de tempo extra");
            }

            user.setExtraTimeBoosts(user.getExtraTimeBoosts() - 1);
            session.setExtraTimeUsed(true);
            hasChanges = true;
        }

        if (!answerCorrect && Boolean.TRUE.equals(request.useExtraLife())) {
            if (session.isExtraLifeUsed()) {
                throw new BadRequestException("Bônus de vida extra já foi usado nesta partida");
            }
            if (user.getExtraLifeBoosts() <= 0) {
                throw new BadRequestException("Você não possui bônus de vida extra");
            }

            user.setExtraLifeBoosts(user.getExtraLifeBoosts() - 1);
            session.setExtraLifeUsed(true);
            extraLifeApplied = true;
            hasChanges = true;
        }

        if (Boolean.TRUE.equals(request.useXpMultiplier())) {
            if (session.isXpMultiplierUsed()) {
                throw new BadRequestException("Bônus de XP em dobro já foi usado nesta partida");
            }
            if (user.getDoubleXpBoosts() <= 0) {
                throw new BadRequestException("Você não possui bônus de XP em dobro");
            }

            user.setDoubleXpBoosts(user.getDoubleXpBoosts() - 1);
            session.setXpMultiplier(gameSettingService.getDoubleXpMultiplier());
            session.setXpMultiplierUsed(true);
            hasChanges = true;
        }

        if (!hasChanges) {
            return false;
        }

        userRepository.save(user);

        return extraLifeApplied;
    }

    private QuizSession getOwnedSession(Long sessionId, Long userId) {
        return quizSessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("Sessão de quiz não encontrada"));
    }

    private Question getCurrentQuestion(QuizSession session) {
        List<Long> ids = parseQuestionIds(session.getQuestionIdsCsv());
        if (session.getCurrentQuestionIndex() < 0 || session.getCurrentQuestionIndex() >= ids.size()) {
            throw new BadRequestException("Índice de pergunta inválido na sessão");
        }

        Long currentId = ids.get(session.getCurrentQuestionIndex());
        return questionRepository.findById(currentId)
                .orElseThrow(() -> new NotFoundException("Pergunta da sessão não encontrada"));
    }

    private List<Long> parseQuestionIds(String csv) {
        if (csv == null || csv.isBlank()) {
            throw new BadRequestException("Sessão sem perguntas configuradas");
        }

        return Arrays.stream(csv.split(","))
                .filter(token -> !token.isBlank())
                .map(String::trim)
                .map(Long::valueOf)
                .toList();
    }

    private QuizSessionStatusResponse toStatusResponse(QuizSession session, Question currentQuestion) {
        return new QuizSessionStatusResponse(
                session.getId(),
                session.getQuizType(),
                session.getStatus(),
                session.getTotalQuestions(),
                session.getCurrentQuestionIndex(),
                session.getLivesRemaining(),
                session.getCorrectAnswers(),
                session.getWrongAnswers(),
                session.getXpMultiplier(),
                currentQuestion != null ? toQuestionView(currentQuestion) : null
        );
    }

    private QuizQuestionViewResponse toQuestionView(Question question) {
        int timeLimit = question.getTimeLimitSeconds();
        return new QuizQuestionViewResponse(
                question.getId(),
                question.getText(),
                question.getDifficulty(),
                timeLimit,
                question.getOptionA(),
                question.getOptionB(),
                question.getOptionC(),
                question.getOptionD()
        );
    }

    private QuizSessionHistoryItemResponse toSessionHistory(QuizSession session) {
        return new QuizSessionHistoryItemResponse(
                session.getId(),
                session.getQuizType(),
                session.getStatus(),
                session.getStartedAt(),
                session.getFinishedAt(),
                session.getTotalQuestions(),
                session.getCorrectAnswers(),
                session.getWrongAnswers(),
                session.getLivesRemaining()
        );
    }

    private QuizMatchHistoryItemResponse toMatchHistory(QuizMatch match) {
        return new QuizMatchHistoryItemResponse(
                match.getId(),
                match.getQuizType(),
                match.getStartedAt(),
                match.getFinishedAt(),
                match.getQuestionsAnswered(),
                match.getCorrectAnswers(),
                match.getWrongAnswers(),
                match.getXpGained(),
                match.getScoreGained(),
                match.isRewardGranted(),
                match.getRewardGrantedName()
        );
    }
}
