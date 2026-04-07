package backend.repository;

import backend.model.GameSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GameSettingRepository extends JpaRepository<GameSetting, Long> {
    Optional<GameSetting> findBySettingKey(String settingKey);
}
