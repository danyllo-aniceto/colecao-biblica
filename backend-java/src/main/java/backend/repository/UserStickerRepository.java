package backend.repository;

import backend.model.UserSticker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserStickerRepository extends JpaRepository<UserSticker, Long> {
    List<UserSticker> findByUserId(Long userId);
    Optional<UserSticker> findByUserIdAndCharacterId(Long userId, Long characterId);
    long countByUserId(Long userId);
}
