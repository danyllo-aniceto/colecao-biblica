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
    public static final String KEY_MAX_EXTRA_LIFE_BOOSTS = "reward.boost.maxExtraLife";
    public static final String KEY_MAX_EXTRA_TIME_BOOSTS = "reward.boost.maxExtraTime";
    public static final String KEY_MAX_DOUBLE_XP_BOOSTS = "reward.boost.maxDoubleXp";
    public static final String KEY_DOUBLE_XP_MULTIPLIER = "reward.boost.doubleXpMultiplier";

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

    public int getMaxExtraLifeBoosts() {
        return getInt(KEY_MAX_EXTRA_LIFE_BOOSTS, 5);
    }

    public int getMaxExtraTimeBoosts() {
        return getInt(KEY_MAX_EXTRA_TIME_BOOSTS, 5);
    }

    public int getMaxDoubleXpBoosts() {
        return getInt(KEY_MAX_DOUBLE_XP_BOOSTS, 5);
    }

    public double getDoubleXpMultiplier() {
        return getDouble(KEY_DOUBLE_XP_MULTIPLIER, 2.0);
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

    public double getDouble(String key, double defaultValue) {
        return repository.findBySettingKey(key)
                .map(GameSetting::getSettingValue)
                .map(value -> {
                    try {
                        return Double.parseDouble(value);
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
                getCharacterStudyXpPercent(),
                getMaxExtraLifeBoosts(),
                getMaxExtraTimeBoosts(),
                getMaxDoubleXpBoosts(),
                getDoubleXpMultiplier()
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
        if (request.maxExtraLifeBoosts() != null) {
            upsert(KEY_MAX_EXTRA_LIFE_BOOSTS, request.maxExtraLifeBoosts().toString(), "Máximo de bônus de vida extra acumulados por usuário");
        }
        if (request.maxExtraTimeBoosts() != null) {
            upsert(KEY_MAX_EXTRA_TIME_BOOSTS, request.maxExtraTimeBoosts().toString(), "Máximo de bônus de tempo extra acumulados por usuário");
        }
        if (request.maxDoubleXpBoosts() != null) {
            upsert(KEY_MAX_DOUBLE_XP_BOOSTS, request.maxDoubleXpBoosts().toString(), "Máximo de bônus de XP em dobro acumulados por usuário");
        }
        if (request.doubleXpMultiplier() != null) {
            upsert(KEY_DOUBLE_XP_MULTIPLIER, request.doubleXpMultiplier().toString(), "Multiplicador aplicado ao usar XP em dobro");
        }

        return getSettings();
    }
}
