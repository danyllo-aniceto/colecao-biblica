package backend.controller;

import backend.dto.AnswerQuizQuestionRequest;
import backend.dto.AnswerQuizQuestionResponse;
import backend.dto.QuizHistoryResponse;
import backend.dto.QuizSessionStatusResponse;
import backend.dto.StartQuizSessionRequest;
import backend.model.QuizSessionStatus;
import backend.model.QuizType;
import backend.service.QuizSessionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuizControllerDelegationTest {

    @Mock
    private QuizSessionService quizSessionService;

    @InjectMocks
    private QuizController controller;

    @Test
    void shouldDelegateSessionEndpoints() {
        StartQuizSessionRequest startRequest = new StartQuizSessionRequest(QuizType.GENERAL, null, 10);
        QuizSessionStatusResponse startResponse = new QuizSessionStatusResponse(99L, QuizType.GENERAL, QuizSessionStatus.IN_PROGRESS, 10, 0, 3, 0, 0, 1.0, false, false, false, null);
        AnswerQuizQuestionRequest answerRequest = new AnswerQuizQuestionRequest(1L, "A", false, false);
        AnswerQuizQuestionResponse answerResponse = new AnswerQuizQuestionResponse(true, false, 3, 1, 0, false, false, false, false, null, null);
        QuizHistoryResponse historyResponse = new QuizHistoryResponse(List.of(), List.of());

        when(quizSessionService.startSession(startRequest)).thenReturn(startResponse);
        when(quizSessionService.getSessionStatus(99L)).thenReturn(startResponse);
        when(quizSessionService.getActiveSession()).thenReturn(startResponse);
        when(quizSessionService.answerQuestion(99L, answerRequest)).thenReturn(answerResponse);
        when(quizSessionService.abandonSession(99L)).thenReturn(startResponse);
        when(quizSessionService.useExtraTime(99L)).thenReturn(startResponse);
        when(quizSessionService.getMyHistory(20)).thenReturn(historyResponse);

        assertSame(startResponse, controller.startSession(startRequest));
        assertSame(startResponse, controller.getSessionStatus(99L));
        assertSame(startResponse, controller.getActiveSession());
        assertSame(answerResponse, controller.answerQuestion(99L, answerRequest));
        assertSame(startResponse, controller.abandonSession(99L));
        assertSame(startResponse, controller.useExtraTime(99L));
        assertSame(historyResponse, controller.history(20));
    }
}
