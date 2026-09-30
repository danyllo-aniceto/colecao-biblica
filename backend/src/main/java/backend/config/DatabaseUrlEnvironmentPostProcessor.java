package backend.config;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Aceita a URL do Postgres no formato usado por Neon/Vercel
 * ({@code postgresql://usuario:senha@host/banco?sslmode=require}) em {@code DATABASE_URL}
 * e a converte para as propriedades JDBC do Spring.
 *
 * <p>Uma URL que já começa com {@code jdbc:} é usada como está. Sem {@code DATABASE_URL},
 * valem os valores de desenvolvimento do application.properties.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String PROPERTY_SOURCE_NAME = "databaseUrl";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        Map<String, Object> properties = toJdbcProperties(databaseUrl.trim());
        environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, properties));
    }

    static Map<String, Object> toJdbcProperties(String databaseUrl) {
        Map<String, Object> properties = new HashMap<>();

        if (databaseUrl.startsWith("jdbc:")) {
            properties.put("spring.datasource.url", databaseUrl);
            return properties;
        }

        if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
            throw new IllegalStateException("DATABASE_URL deve começar com postgresql://, postgres:// ou jdbc:");
        }

        URI uri = URI.create(databaseUrl);
        StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
        if (uri.getPort() > 0) {
            jdbcUrl.append(':').append(uri.getPort());
        }
        jdbcUrl.append(uri.getRawPath());

        String query = uri.getRawQuery();
        // O pooler do Neon (PgBouncer em modo transação) não mantém prepared statements
        // do lado do servidor entre transações; o driver passa a enviá-los sem preparar.
        boolean pooled = uri.getHost() != null && uri.getHost().contains("-pooler");
        if (pooled && (query == null || !query.contains("prepareThreshold"))) {
            query = (query == null || query.isBlank() ? "" : query + "&") + "prepareThreshold=0";
        }
        if (query != null && !query.isBlank()) {
            jdbcUrl.append('?').append(query);
        }
        properties.put("spring.datasource.url", jdbcUrl.toString());

        String userInfo = uri.getRawUserInfo();
        if (userInfo != null && !userInfo.isBlank()) {
            int separator = userInfo.indexOf(':');
            String username = separator >= 0 ? userInfo.substring(0, separator) : userInfo;
            properties.put("spring.datasource.username", URLDecoder.decode(username, StandardCharsets.UTF_8));
            if (separator >= 0) {
                properties.put("spring.datasource.password", URLDecoder.decode(userInfo.substring(separator + 1), StandardCharsets.UTF_8));
            }
        }

        return properties;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
