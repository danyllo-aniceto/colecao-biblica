package backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.Map;

@Component
public class JwtUtil {

    private final Key key;
    private static final long ACCESS_TOKEN_EXPIRATION = 1000L * 60 * 60;
    private static final long REFRESH_TOKEN_EXPIRATION = 1000L * 60 * 60 * 24 * 7;

    public JwtUtil(@Value("${app.jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(String email) {
        return generateToken(email, "ACCESS", ACCESS_TOKEN_EXPIRATION);
    }

    public String generateRefreshToken(String email) {
        return generateToken(email, "REFRESH", REFRESH_TOKEN_EXPIRATION);
    }

    private String generateToken(String email, String tokenType, long expirationMillis) {
        return Jwts.builder()
                .setSubject(email)
                .addClaims(Map.of("token_type", tokenType))
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMillis))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractEmail(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public boolean isValid(String token, String email) {
        return isValid(token, email, "ACCESS");
    }

    public boolean isValidRefreshToken(String token, String email) {
        return isValid(token, email, "REFRESH");
    }

    private boolean isValid(String token, String email, String expectedType) {
        return extractEmail(token).equals(email) && expectedType.equals(extractTokenType(token));
    }

    private String extractTokenType(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .get("token_type", String.class);
    }
}