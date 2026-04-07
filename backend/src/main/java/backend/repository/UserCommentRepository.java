package backend.repository;

import backend.model.UserComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserCommentRepository extends JpaRepository<UserComment, Long> {
    List<UserComment> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<UserComment> findByIdAndUserId(Long id, Long userId);
}
