package backend.config;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DatabaseUrlEnvironmentPostProcessorTest {

    @Test
    void convertsNeonPooledUrl() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.toJdbcProperties(
                "postgresql://neondb_owner:p%40ss@ep-cool-name-123456-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

        assertEquals("jdbc:postgresql://ep-cool-name-123456-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&prepareThreshold=0",
                props.get("spring.datasource.url"));
        assertEquals("neondb_owner", props.get("spring.datasource.username"));
        assertEquals("p@ss", props.get("spring.datasource.password"));
    }

    @Test
    void convertsDirectUrlWithPortWithoutTouchingPrepareThreshold() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.toJdbcProperties(
                "postgres://user:secret@localhost:5432/backend_db?sslmode=disable");

        assertEquals("jdbc:postgresql://localhost:5432/backend_db?sslmode=disable", props.get("spring.datasource.url"));
        assertEquals("user", props.get("spring.datasource.username"));
        assertEquals("secret", props.get("spring.datasource.password"));
    }

    @Test
    void keepsJdbcUrlAsIs() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.toJdbcProperties("jdbc:postgresql://db/app");

        assertEquals("jdbc:postgresql://db/app", props.get("spring.datasource.url"));
        assertFalse(props.containsKey("spring.datasource.username"));
    }

    @Test
    void rejectsUnknownScheme() {
        assertThrows(IllegalStateException.class, () -> DatabaseUrlEnvironmentPostProcessor.toJdbcProperties("mysql://x/y"));
    }
}
