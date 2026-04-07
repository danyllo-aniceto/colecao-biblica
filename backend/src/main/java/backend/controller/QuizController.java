package backend.controller;

import backend.dto.AnswerQuizQuestionRequest;
import backend.dto.AnswerQuizQuestionResponse;
import backend.dto.QuizHistoryResponse;
import backend.dto.QuizSessionStatusResponse;
import backend.dto.QuizMatchResultResponse;
import backend.dto.StartQuizSessionRequest;
import backend.dto.SubmitQuizMatchRequest;
import backend.service.QuizSessionService;
import backend.service.QuizService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/quiz")
public class QuizController {

    private final QuizService service;
    private final QuizSessionService sessionService;

    public QuizController(QuizService service, QuizSessionService sessionService) {
        this.service = service;
        this.sessionService = sessionService;
    }

    @PostMapping("/matches/submit")
    public QuizMatchResultResponse submitResult(@Valid @RequestBody SubmitQuizMatchRequest request) {
        return service.submitMatchResult(request);
    }

    @PostMapping("/sessions/start")
    public QuizSessionStatusResponse startSession(@Valid @RequestBody StartQuizSessionRequest request) {
        return sessionService.startSession(request);
    }

    @GetMapping("/sessions/{sessionId}")
    public QuizSessionStatusResponse getSessionStatus(@PathVariable Long sessionId) {
        return sessionService.getSessionStatus(sessionId);
    }

    @GetMapping("/sessions/active")
    public QuizSessionStatusResponse getActiveSession() {
        return sessionService.getActiveSession();
    }

    @PostMapping("/sessions/{sessionId}/answer")
    public AnswerQuizQuestionResponse answerQuestion(@PathVariable Long sessionId,
                                                     @Valid @RequestBody AnswerQuizQuestionRequest request) {
        return sessionService.answerQuestion(sessionId, request);
    }

    @PostMapping("/sessions/{sessionId}/abandon")
    public QuizSessionStatusResponse abandonSession(@PathVariable Long sessionId) {
        return sessionService.abandonSession(sessionId);
    }

    @GetMapping("/history")
    public QuizHistoryResponse history(@RequestParam(defaultValue = "20") int limit) {
        return sessionService.getMyHistory(limit);
    }
}
