package backend.repository;

import backend.model.QuizMatch;
import backend.model.QuizType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface QuizMatchRepository extends JpaRepository<QuizMatch, Long> {
    long countByUserIdAndQuizTypeAndRewardGrantedTrueAndFinishedAtBetween(Long userId, QuizType quizType, Instant start, Instant end);
    List<QuizMatch> findByUserIdOrderByFinishedAtDesc(Long userId);
}
