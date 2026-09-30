package backend.repository;

import backend.model.QuizSession;
import backend.model.QuizSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuizSessionRepository extends JpaRepository<QuizSession, Long> {
    Optional<QuizSession> findByIdAndUserId(Long id, Long userId);
    boolean existsByUserIdAndStatus(Long userId, QuizSessionStatus status);
    List<QuizSession> findByUserIdOrderByStartedAtDesc(Long userId);
    Optional<QuizSession> findFirstByUserIdAndStatusOrderByStartedAtDesc(Long userId, QuizSessionStatus status);
}
