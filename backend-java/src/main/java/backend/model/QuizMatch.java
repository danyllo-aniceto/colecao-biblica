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
@Table(name = "quiz_matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuizType quizType;

    private Instant startedAt;

    @Column(nullable = false)
    private Instant finishedAt;

    @Column(nullable = false)
    private int questionsAnswered;

    @Column(nullable = false)
    private int correctAnswers;

    @Column(nullable = false)
    private int wrongAnswers;

    @Column(nullable = false)
    private int xpGained;

    @Column(nullable = false)
    private int scoreGained;

    @Column(nullable = false)
    private boolean rewardGranted;

    private String rewardGrantedName;
}
