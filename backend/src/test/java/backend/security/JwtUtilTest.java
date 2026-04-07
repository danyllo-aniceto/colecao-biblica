package backend.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtUtilTest {

    private final JwtUtil jwtUtil = new JwtUtil("test-secret-test-secret-test-secret-test-secret");

    @Test
    void accessTokenShouldValidateOnlyAsAccess() {
        String email = "user@email.com";
        String accessToken = jwtUtil.generateAccessToken(email);

        assertEquals(email, jwtUtil.extractEmail(accessToken));
        assertTrue(jwtUtil.isValid(accessToken, email));
        assertFalse(jwtUtil.isValidRefreshToken(accessToken, email));
    }

    @Test
    void refreshTokenShouldValidateOnlyAsRefresh() {
        String email = "user@email.com";
        String refreshToken = jwtUtil.generateRefreshToken(email);

        assertEquals(email, jwtUtil.extractEmail(refreshToken));
        assertTrue(jwtUtil.isValidRefreshToken(refreshToken, email));
        assertFalse(jwtUtil.isValid(refreshToken, email));
    }
}
