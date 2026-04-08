package backend.config;

import backend.model.BiblicalCharacter;
import backend.model.Question;
import backend.model.QuestionDifficulty;
import backend.model.RewardType;
import backend.model.Role;
import backend.model.StickerRarity;
import backend.model.User;
import backend.repository.BiblicalCharacterRepository;
import backend.repository.QuestionRepository;
import backend.repository.UserRepository;
import backend.service.GameSettingService;
import backend.service.RewardService;
import backend.service.ShopService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Configuration
@Profile("!test")
public class SeedDataConfig {

    @Bean
    CommandLineRunner seedData(BiblicalCharacterRepository characterRepository,
                               QuestionRepository questionRepository,
                               UserRepository userRepository,
                               PasswordEncoder passwordEncoder,
                               GameSettingService gameSettingService,
                               RewardService rewardService,
                               ShopService shopService) {
        return args -> {
            // Legacy REWARD_TICKET records will not be loaded due to enum removal
            // No cleanup needed as the enum is completely removed from the system
            
            gameSettingService.upsert(GameSettingService.KEY_MAX_QUESTIONS_PER_MATCH, "100", "Máximo de perguntas por partida geral");
            gameSettingService.upsert(GameSettingService.KEY_STARTING_LIVES, "3", "Vidas iniciais por partida geral");
            gameSettingService.upsert(GameSettingService.KEY_REWARD_MATCH_LIMIT_PER_DAY, "4", "Limite diário de partidas com recompensa");
            gameSettingService.upsert(GameSettingService.KEY_XP_CHARACTER_STUDY_PERCENT, "35", "Percentual de XP em quiz de personagem");
                        gameSettingService.upsert(GameSettingService.KEY_MAX_EXTRA_LIFE_BOOSTS, "5", "Máximo de bônus de vida extra acumulados por usuário");
                        gameSettingService.upsert(GameSettingService.KEY_MAX_EXTRA_TIME_BOOSTS, "5", "Máximo de bônus de tempo extra acumulados por usuário");
                        gameSettingService.upsert(GameSettingService.KEY_MAX_DOUBLE_XP_BOOSTS, "5", "Máximo de bônus de XP em dobro acumulados por usuário");
                        gameSettingService.upsert(GameSettingService.KEY_DOUBLE_XP_MULTIPLIER, "2.0", "Multiplicador aplicado ao usar XP em dobro");

            ensureUser(userRepository, passwordEncoder, "Admin Teste", "admin2@email.com", "123456", Role.ADMIN);
            ensureUser(userRepository, passwordEncoder, "Usuário Teste", "user@email.com", "123456", Role.USER);

            if (characterRepository.count() == 0) {
                BiblicalCharacter david = characterRepository.save(BiblicalCharacter.builder()
                        .name("Davi")
                        .rarity(StickerRarity.RARE)
                        .shortSummary("Rei de Israel e homem segundo o coração de Deus")
                        .fullDescription("Davi foi pastor, guerreiro e rei. Destacou-se por sua fé, liderança e arrependimento.")
                        .bibleBooks("1 Samuel, 2 Samuel, Salmos")
                        .bibleReferences("1Sm 16-31; 2Sm 1-24")
                        .historicalPeriod("Monarquia unida de Israel")
                        .narrativeRole("Rei e salmista")
                        .curiosities("Derrotou Golias quando ainda era jovem")
                        .importantEvents("Unção por Samuel; derrota de Golias; reinado em Jerusalém")
                        .keyVerses("Salmo 23; 1Sm 17")
                        .keywords("fé, coragem, liderança")
                        .build());

                BiblicalCharacter ester = characterRepository.save(BiblicalCharacter.builder()
                        .name("Ester")
                        .rarity(StickerRarity.EPIC)
                        .shortSummary("Rainha que intercedeu por seu povo")
                        .fullDescription("Ester foi usada por Deus para preservar os judeus no império persa.")
                        .bibleBooks("Ester")
                        .bibleReferences("Et 1-10")
                        .historicalPeriod("Período persa")
                        .narrativeRole("Intercessora e rainha")
                        .curiosities("Seu nome hebraico era Hadassa")
                        .importantEvents("Concurso para rainha; denúncia de Hamã; livramento dos judeus")
                        .keyVerses("Et 4:14")
                        .keywords("coragem, providência, intercessão")
                        .build());

                BiblicalCharacter paulo = characterRepository.save(BiblicalCharacter.builder()
                        .name("Paulo")
                        .rarity(StickerRarity.LEGENDARY)
                        .shortSummary("Apóstolo missionário aos gentios")
                        .fullDescription("Paulo, antes Saulo, foi transformado por Cristo e tornou-se um dos principais missionários da igreja primitiva.")
                        .bibleBooks("Atos, Romanos, 1-2 Coríntios e outras epístolas")
                        .bibleReferences("At 9-28")
                        .historicalPeriod("Igreja primitiva")
                        .narrativeRole("Apóstolo e teólogo")
                        .curiosities("Realizou várias viagens missionárias")
                        .importantEvents("Conversão no caminho de Damasco; viagens missionárias; prisões")
                        .keyVerses("Rm 8:1; Gl 2:20")
                        .keywords("graça, missão, evangelho")
                        .build());

                if (questionRepository.count() == 0) {
                    questionRepository.save(Question.builder()
                            .text("Quem derrotou Golias?")
                            .difficulty(QuestionDifficulty.EASY)
                            .timeLimitSeconds(30)
                            .optionA("Saul")
                            .optionB("Davi")
                            .optionC("Jônatas")
                            .optionD("Samuel")
                            .correctOption("B")
                            .relatedCharacter(david)
                            .active(true)
                            .build());

                    questionRepository.save(Question.builder()
                            .text("Em qual livro encontramos a história de Ester?")
                            .difficulty(QuestionDifficulty.EASY)
                            .timeLimitSeconds(30)
                            .optionA("Rute")
                            .optionB("Ester")
                            .optionC("Neemias")
                            .optionD("Esdras")
                            .correctOption("B")
                            .relatedCharacter(ester)
                            .active(true)
                            .build());

                    questionRepository.save(Question.builder()
                            .text("Qual era o nome de Paulo antes da conversão?")
                            .difficulty(QuestionDifficulty.MEDIUM)
                            .timeLimitSeconds(25)
                            .optionA("Silas")
                            .optionB("Barnabé")
                            .optionC("Saulo")
                            .optionD("Timóteo")
                            .correctOption("C")
                            .relatedCharacter(paulo)
                            .active(true)
                            .build());
                }
            }

            rewardService.ensureFixedRewards();
            shopService.ensureFixedShopItems();
        };
    }

    private void ensureUser(UserRepository userRepository,
                            PasswordEncoder passwordEncoder,
                            String name,
                            String email,
                            String password,
                            Role role) {
        userRepository.findByEmailAndDeletedFalse(email).orElseGet(() -> userRepository.save(User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(password))
                .role(role)
                .createdBy(email)
                .updatedBy(email)
                .build()));
    }
}
