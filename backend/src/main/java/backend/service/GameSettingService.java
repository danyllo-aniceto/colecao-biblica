package backend.service;

import backend.dto.GameSettingsResponse;
import backend.dto.UpdateGameSettingsRequest;
import backend.model.GameSetting;
import backend.repository.GameSettingRepository;
import org.springframework.stereotype.Service;

@Service
public class GameSettingService {

    public static final String KEY_MAX_QUESTIONS_PER_MATCH = "quiz.general.maxQuestions";
    public static final String KEY_STARTING_LIVES = "quiz.general.startingLives";
    public static final String KEY_REWARD_MATCH_LIMIT_PER_DAY = "quiz.general.rewardLimitPerDay";
    public static final String KEY_XP_CHARACTER_STUDY_PERCENT = "quiz.characterStudy.xpPercent";

    private final GameSettingRepository repository;

    public GameSettingService(GameSettingRepository repository) {
        this.repository = repository;
    }

    public int getMaxQuestionsPerMatch() {
        return getInt(KEY_MAX_QUESTIONS_PER_MATCH, 100);
    }

    public int getStartingLives() {
        return getInt(KEY_STARTING_LIVES, 3);
    }

    public int getRewardMatchLimitPerDay() {
        return getInt(KEY_REWARD_MATCH_LIMIT_PER_DAY, 4);
    }

    public int getCharacterStudyXpPercent() {
        return getInt(KEY_XP_CHARACTER_STUDY_PERCENT, 35);
    }

    public int getInt(String key, int defaultValue) {
        return repository.findBySettingKey(key)
                .map(GameSetting::getSettingValue)
                .map(value -> {
                    try {
                        return Integer.parseInt(value);
                    } catch (NumberFormatException ignored) {
                        return defaultValue;
                    }
                })
                .orElse(defaultValue);
    }

    public GameSetting upsert(String key, String value, String description) {
        GameSetting setting = repository.findBySettingKey(key)
                .orElse(GameSetting.builder().settingKey(key).build());
        setting.setSettingValue(value);
        setting.setDescription(description);
        return repository.save(setting);
    }

    public GameSettingsResponse getSettings() {
        return new GameSettingsResponse(
                getMaxQuestionsPerMatch(),
                getStartingLives(),
                getRewardMatchLimitPerDay(),
                getCharacterStudyXpPercent()
        );
    }

    public GameSettingsResponse updateSettings(UpdateGameSettingsRequest request) {
        if (request.maxQuestionsPerMatch() != null) {
            upsert(KEY_MAX_QUESTIONS_PER_MATCH, request.maxQuestionsPerMatch().toString(), "Máximo de perguntas por partida geral");
        }
        if (request.startingLives() != null) {
            upsert(KEY_STARTING_LIVES, request.startingLives().toString(), "Vidas iniciais por partida geral");
        }
        if (request.rewardMatchLimitPerDay() != null) {
            upsert(KEY_REWARD_MATCH_LIMIT_PER_DAY, request.rewardMatchLimitPerDay().toString(), "Limite diário de partidas com recompensa");
        }
        if (request.characterStudyXpPercent() != null) {
            upsert(KEY_XP_CHARACTER_STUDY_PERCENT, request.characterStudyXpPercent().toString(), "Percentual de XP em quiz de personagem");
        }

        return getSettings();
    }
}
