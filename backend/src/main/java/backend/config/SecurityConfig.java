package backend.config;

import backend.security.CustomUserDetailsService;
import backend.security.JwtFilter;
import backend.security.JwtUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   JwtUtil jwtUtil,
                                                   CustomUserDetailsService userService) throws Exception {
        JwtFilter jwtFilter = new JwtFilter(jwtUtil, userService);

        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/error", "/error/**", "/auth/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/users", "/users/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/characters/admin", "/questions/admin", "/rewards/admin", "/shop/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/characters/admin/**", "/questions/admin/**", "/rewards/admin/**", "/shop/admin/**", "/settings/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/characters/admin/**", "/questions/admin/**", "/rewards/admin/**", "/shop/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/users", "/users/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/users/**").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/users/**").authenticated()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}