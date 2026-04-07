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

import java.time.Instant;

@Entity
@Table(name = "quiz_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuizType quizType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "character_id")
    private BiblicalCharacter character;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuizSessionStatus status;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant finishedAt;

    @Column(nullable = false)
    private int totalQuestions;

    @Column(nullable = false)
    private int currentQuestionIndex;

    @Column(nullable = false)
    private int livesRemaining;

    @Column(nullable = false)
    private int correctAnswers;

    @Column(nullable = false)
    private int wrongAnswers;

    @Builder.Default
    @Column(nullable = false)
    private double xpMultiplier = 1.0;

    @Column(nullable = false)
    private int rewardTicketsSpent;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionIdsCsv;
}
