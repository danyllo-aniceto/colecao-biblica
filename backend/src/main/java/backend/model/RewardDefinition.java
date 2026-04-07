package backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reward_definitions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RewardDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RewardType rewardType;

    @Enumerated(EnumType.STRING)
    private StickerRarity stickerRarity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sticker_character_id")
    private BiblicalCharacter stickerCharacter;

    private Integer coinAmount;

    private Integer extraLives;

    private Integer extraTimeSeconds;

    private Double xpMultiplier;

    private Integer ticketAmount;

    @Column(nullable = false)
    private Double dropChance;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
