package backend.config;

import backend.model.BiblicalCharacter;
import backend.model.Question;
import backend.model.QuestionDifficulty;
import backend.model.RewardDefinition;
import backend.model.RewardType;
import backend.model.ShopItem;
import backend.model.ShopItemType;
import backend.model.StickerRarity;
import backend.repository.BiblicalCharacterRepository;
import backend.repository.QuestionRepository;
import backend.repository.RewardDefinitionRepository;
import backend.repository.ShopItemRepository;
import backend.service.GameSettingService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!test")
public class SeedDataConfig {

    @Bean
    CommandLineRunner seedData(BiblicalCharacterRepository characterRepository,
                               QuestionRepository questionRepository,
                               RewardDefinitionRepository rewardRepository,
                               ShopItemRepository shopItemRepository,
                               GameSettingService gameSettingService) {
        return args -> {
            gameSettingService.upsert(GameSettingService.KEY_MAX_QUESTIONS_PER_MATCH, "100", "Máximo de perguntas por partida geral");
            gameSettingService.upsert(GameSettingService.KEY_STARTING_LIVES, "3", "Vidas iniciais por partida geral");
            gameSettingService.upsert(GameSettingService.KEY_REWARD_MATCH_LIMIT_PER_DAY, "4", "Limite diário de partidas com recompensa");
            gameSettingService.upsert(GameSettingService.KEY_XP_CHARACTER_STUDY_PERCENT, "35", "Percentual de XP em quiz de personagem");

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

            if (rewardRepository.count() == 0) {
                RewardDefinition commonCoins = rewardRepository.save(RewardDefinition.builder()
                        .name("Moedas Comuns")
                        .rewardType(RewardType.COINS)
                        .coinAmount(25)
                        .dropChance(40.0)
                        .active(true)
                        .build());

                RewardDefinition rareCoins = rewardRepository.save(RewardDefinition.builder()
                        .name("Moedas Raras")
                        .rewardType(RewardType.COINS)
                        .coinAmount(75)
                        .dropChance(25.0)
                        .active(true)
                        .build());

                RewardDefinition ticket = rewardRepository.save(RewardDefinition.builder()
                        .name("Ticket de Recompensa")
                        .rewardType(RewardType.REWARD_TICKET)
                        .ticketAmount(1)
                        .dropChance(10.0)
                        .active(true)
                        .build());

                if (shopItemRepository.count() == 0) {
                    shopItemRepository.save(ShopItem.builder()
                            .name("Pacote de Moedas")
                            .description("Concede moedas para compras na loja")
                            .itemType(ShopItemType.ECONOMY)
                            .priceCoins(100)
                            .rewardDefinition(commonCoins)
                            .active(true)
                            .build());

                    shopItemRepository.save(ShopItem.builder()
                            .name("Pacote Raro")
                            .description("Chance de progresso acelerado")
                            .itemType(ShopItemType.GAME_BONUS)
                            .priceCoins(250)
                            .rewardDefinition(rareCoins)
                            .active(true)
                            .build());

                    shopItemRepository.save(ShopItem.builder()
                            .name("Ticket Extra")
                            .description("Receba um ticket para recompensas")
                            .itemType(ShopItemType.ECONOMY)
                            .priceCoins(180)
                            .rewardDefinition(ticket)
                            .active(true)
                            .build());
                }
            }
        };
    }
}
