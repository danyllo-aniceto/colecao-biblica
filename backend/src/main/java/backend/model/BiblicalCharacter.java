package backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "biblical_characters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BiblicalCharacter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StickerRarity rarity;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String shortSummary;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String fullDescription;

    @Column(columnDefinition = "TEXT")
    private String bibleBooks;

    @Column(columnDefinition = "TEXT")
    private String bibleReferences;

    @Column(columnDefinition = "TEXT")
    private String historicalPeriod;

    @Column(columnDefinition = "TEXT")
    private String narrativeRole;

    @Column(columnDefinition = "TEXT")
    private String genealogy;

    @Column(columnDefinition = "TEXT")
    private String curiosities;

    @Column(columnDefinition = "TEXT")
    private String importantEvents;

    @Column(columnDefinition = "TEXT")
    private String keyVerses;

    @Column(columnDefinition = "TEXT")
    private String keywords;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @CreatedBy
    @Column(nullable = false, updatable = false)
    private String createdBy;

    @LastModifiedDate
    private Instant updatedAt;
}
