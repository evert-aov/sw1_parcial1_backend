import { JavaClassMeta, ProjectContext } from './template-models';

/**
 * Renderiza el JwtTokenProvider para firmar y validar tokens JWT.
 */
export function renderJwtTokenProvider(context: ProjectContext, userClass: JavaClassMeta): string {
  return [
    `package ${context.packageName}.security;`,
    '',
    'import io.jsonwebtoken.*;',
    'import io.jsonwebtoken.io.Decoders;',
    'import io.jsonwebtoken.security.Keys;',
    'import org.springframework.beans.factory.annotation.Value;',
    'import org.springframework.stereotype.Component;',
    'import javax.crypto.SecretKey;',
    'import java.util.Date;',
    'import java.util.UUID;',
    '',
    '/**',
    ' * Proveedor de servicios criptográficos para generación y validación de tokens JWT.',
    ' */',
    '@Component',
    'public class JwtTokenProvider {',
    '',
    '    @Value("${jwt.secret:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}")',
    '    private String jwtSecret;',
    '',
    '    @Value("${jwt.expiration:86400000}")',
    '    private long jwtExpirationInMs;',
    '',
    '    private SecretKey getSigningKey() {',
    '        byte[] keyBytes = Decoders.BASE64.decode(this.jwtSecret);',
    '        return Keys.hmacShaKeyFor(keyBytes);',
    '    }',
    '',
    '    public String generateToken(String username, UUID userId) {',
    '        Date now = new Date();',
    '        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);',
    '',
    '        return Jwts.builder()',
    '                .subject(username)',
    '                .claim("userId", userId != null ? userId.toString() : "")',
    '                .issuedAt(now)',
    '                .expiration(expiryDate)',
    '                .signWith(getSigningKey())',
    '                .compact();',
    '    }',
    '',
    '    public String getUsernameFromJWT(String token) {',
    '        Claims claims = Jwts.parser()',
    '                .verifyWith(getSigningKey())',
    '                .build()',
    '                .parseSignedClaims(token)',
    '                .getPayload();',
    '        return claims.getSubject();',
    '    }',
    '',
    '    public boolean validateToken(String authToken) {',
    '        try {',
    '            Jwts.parser()',
    '                    .verifyWith(getSigningKey())',
    '                    .build()',
    '                    .parseSignedClaims(authToken);',
    '            return true;',
    '        } catch (JwtException | IllegalArgumentException ex) {',
    '            return false;',
    '        }',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza el UserPrincipal adaptador para Spring Security UserDetails.
 */
export function renderUserPrincipal(context: ProjectContext, userClass: JavaClassMeta): string {
  const idType = userClass.idField.javaType;
  const usernameGetter = userClass.fields.some((f) => f.name === 'email')
    ? 'getEmail'
    : userClass.fields.some((f) => f.name === 'username')
      ? 'getUsername'
      : userClass.fields[1]?.getterName || 'getId';

  return [
    `package ${context.packageName}.security;`,
    '',
    `import ${context.packageName}.entities.${userClass.className};`,
    'import org.springframework.security.core.GrantedAuthority;',
    'import org.springframework.security.core.authority.SimpleGrantedAuthority;',
    'import org.springframework.security.core.userdetails.UserDetails;',
    'import java.util.Collection;',
    'import java.util.Collections;',
    idType === 'UUID' ? 'import java.util.UUID;' : '',
    '',
    '/**',
    ` * Adaptador de seguridad para la entidad ${userClass.className}.`,
    ' */',
    'public class UserPrincipal implements UserDetails {',
    '',
    `    private final ${idType} id;`,
    '    private final String username;',
    '    private final String password;',
    '    private final Collection<? extends GrantedAuthority> authorities;',
    '',
    `    public UserPrincipal(${idType} id, String username, String password, Collection<? extends GrantedAuthority> authorities) {`,
    '        this.id = id;',
    '        this.username = username;',
    '        this.password = password;',
    '        this.authorities = authorities;',
    '    }',
    '',
    `    public static UserPrincipal create(${userClass.className} user) {`,
    '        String role = "ROLE_USER";',
    '        return new UserPrincipal(',
    '                user.getId(),',
    `                user.${usernameGetter}() != null ? user.${usernameGetter}().toString() : "user",`,
    '                user.getPassword() != null ? user.getPassword() : "",',
    '                Collections.singletonList(new SimpleGrantedAuthority(role))',
    '        );',
    '    }',
    '',
    `    public ${idType} getId() {`,
    '        return id;',
    '    }',
    '',
    '    @Override',
    '    public String getUsername() {',
    '        return username;',
    '    }',
    '',
    '    @Override',
    '    public String getPassword() {',
    '        return password;',
    '    }',
    '',
    '    @Override',
    '    public Collection<? extends GrantedAuthority> getAuthorities() {',
    '        return authorities;',
    '    }',
    '',
    '    @Override',
    '    public boolean isAccountNonExpired() {',
    '        return true;',
    '    }',
    '',
    '    @Override',
    '    public boolean isAccountNonLocked() {',
    '        return true;',
    '    }',
    '',
    '    @Override',
    '    public boolean isCredentialsNonExpired() {',
    '        return true;',
    '    }',
    '',
    '    @Override',
    '    public boolean isEnabled() {',
    '        return true;',
    '    }',
    '}',
    '',
  ].filter(Boolean).join('\n');
}

/**
 * Renderiza el CustomUserDetailsService para cargar usuarios desde el repositorio.
 */
export function renderCustomUserDetailsService(context: ProjectContext, userClass: JavaClassMeta): string {
  const hasUsername = userClass.fields.some((f) => f.name === 'username');
  const hasEmail = userClass.fields.some((f) => f.name === 'email');

  return [
    `package ${context.packageName}.security;`,
    '',
    `import ${context.packageName}.entities.${userClass.className};`,
    `import ${context.packageName}.repositories.${userClass.className}Repository;`,
    'import org.springframework.security.core.userdetails.UserDetails;',
    'import org.springframework.security.core.userdetails.UserDetailsService;',
    'import org.springframework.security.core.userdetails.UsernameNotFoundException;',
    'import org.springframework.stereotype.Service;',
    'import org.springframework.transaction.annotation.Transactional;',
    '',
    '/**',
    ' * Servicio de carga de usuarios para el motor de autenticación de Spring Security.',
    ' */',
    '@Service',
    'public class CustomUserDetailsService implements UserDetailsService {',
    '',
    `    private final ${userClass.className}Repository userRepository;`,
    '',
    `    public CustomUserDetailsService(${userClass.className}Repository userRepository) {`,
    '        this.userRepository = userRepository;',
    '    }',
    '',
    '    @Override',
    '    @Transactional(readOnly = true)',
    '    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {',
    hasEmail && hasUsername
      ? `        ${userClass.className} user = userRepository.findByEmail(username)
                .or(() -> userRepository.findByUsername(username))
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con identificador: " + username));`
      : hasEmail
        ? `        ${userClass.className} user = userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con identificador: " + username));`
        : hasUsername
          ? `        ${userClass.className} user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con identificador: " + username));`
          : `        ${userClass.className} user = userRepository.findById(java.util.UUID.fromString(username))
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con identificador: " + username));`,
    '        return UserPrincipal.create(user);',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza el filtro interceptor JwtAuthenticationFilter.
 */
export function renderJwtAuthenticationFilter(context: ProjectContext): string {
  return [
    `package ${context.packageName}.security;`,
    '',
    'import jakarta.servlet.FilterChain;',
    'import jakarta.servlet.ServletException;',
    'import jakarta.servlet.http.HttpServletRequest;',
    'import jakarta.servlet.http.HttpServletResponse;',
    'import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;',
    'import org.springframework.security.core.context.SecurityContextHolder;',
    'import org.springframework.security.core.userdetails.UserDetails;',
    'import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;',
    'import org.springframework.stereotype.Component;',
    'import org.springframework.util.StringUtils;',
    'import org.springframework.web.filter.OncePerRequestFilter;',
    'import java.io.IOException;',
    '',
    '/**',
    ' * Filtro HTTP para interceptar y validar el header Authorization Bearer JWT.',
    ' */',
    '@Component',
    'public class JwtAuthenticationFilter extends OncePerRequestFilter {',
    '',
    '    private final JwtTokenProvider tokenProvider;',
    '    private final CustomUserDetailsService userDetailsService;',
    '',
    '    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, CustomUserDetailsService userDetailsService) {',
    '        this.tokenProvider = tokenProvider;',
    '        this.userDetailsService = userDetailsService;',
    '    }',
    '',
    '    @Override',
    '    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)',
    '            throws ServletException, IOException {',
    '        try {',
    '            String jwt = getJwtFromRequest(request);',
    '',
    '            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {',
    '                String username = tokenProvider.getUsernameFromJWT(jwt);',
    '                UserDetails userDetails = userDetailsService.loadUserByUsername(username);',
    '',
    '                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(',
    '                        userDetails, null, userDetails.getAuthorities());',
    '                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));',
    '',
    '                SecurityContextHolder.getContext().setAuthentication(authentication);',
    '            }',
    '        } catch (Exception ex) {',
    '            logger.error("No se pudo autenticar al usuario en el contexto de seguridad", ex);',
    '        }',
    '',
    '        filterChain.doFilter(request, response);',
    '    }',
    '',
    '    private String getJwtFromRequest(HttpServletRequest request) {',
    '        String bearerToken = request.getHeader("Authorization");',
    '        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {',
    '            return bearerToken.substring(7);',
    '        }',
    '        return null;',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza la configuración de seguridad SecurityConfig de Spring Boot 3+.
 */
export function renderSecurityConfig(context: ProjectContext): string {
  return [
    `package ${context.packageName}.security;`,
    '',
    'import org.springframework.context.annotation.Bean;',
    'import org.springframework.context.annotation.Configuration;',
    'import org.springframework.security.authentication.AuthenticationManager;',
    'import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;',
    'import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;',
    'import org.springframework.security.config.annotation.web.builders.HttpSecurity;',
    'import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;',
    'import org.springframework.security.config.http.SessionCreationPolicy;',
    'import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;',
    'import org.springframework.security.crypto.password.PasswordEncoder;',
    'import org.springframework.security.web.SecurityFilterChain;',
    'import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;',
    'import org.springframework.web.cors.CorsConfiguration;',
    'import org.springframework.web.cors.CorsConfigurationSource;',
    'import org.springframework.web.cors.UrlBasedCorsConfigurationSource;',
    'import java.util.Arrays;',
    'import java.util.List;',
    '',
    '/**',
    ' * Configuración central de seguridad y control de acceso basada en Spring Security 6.',
    ' */',
    '@Configuration',
    '@EnableWebSecurity',
    '@EnableMethodSecurity',
    'public class SecurityConfig {',
    '',
    '    private final JwtAuthenticationFilter jwtAuthenticationFilter;',
    '',
    '    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {',
    '        this.jwtAuthenticationFilter = jwtAuthenticationFilter;',
    '    }',
    '',
    '    @Bean',
    '    public PasswordEncoder passwordEncoder() {',
    '        return new BCryptPasswordEncoder();',
    '    }',
    '',
    '    @Bean',
    '    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {',
    '        return authConfig.getAuthenticationManager();',
    '    }',
    '',
    '    @Bean',
    '    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {',
    '        http',
    '            .cors(cors -> cors.configurationSource(corsConfigurationSource()))',
    '            .csrf(csrf -> csrf.disable())',
    '            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))',
    '            .authorizeHttpRequests(auth -> auth',
    '                .requestMatchers(',
    '                    "/api/v1/auth/**",',
    '                    "/swagger-ui/**",',
    '                    "/swagger-ui.html",',
    '                    "/v3/api-docs/**",',
    '                    "/api-docs/**",',
    '                    "/actuator/**"',
    '                ).permitAll()',
    '                .anyRequest().authenticated()',
    '            );',
    '',
    '        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);',
    '',
    '        return http.build();',
    '    }',
    '',
    '    @Bean',
    '    public CorsConfigurationSource corsConfigurationSource() {',
    '        CorsConfiguration configuration = new CorsConfiguration();',
    '        configuration.setAllowedOrigins(List.of("*"));',
    '        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));',
    '        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept", "X-Requested-With"));',
    '',
    '        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();',
    '        source.registerCorsConfiguration("/**", configuration);',
    '        return source;',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza LoginRequestDto.
 */
export function renderLoginRequestDto(context: ProjectContext): string {
  return [
    `package ${context.packageName}.dtos.auth;`,
    '',
    'import jakarta.validation.constraints.NotBlank;',
    '',
    'public class LoginRequestDto {',
    '',
    '    @NotBlank(message = "El identificador o email es requerido")',
    '    private String email;',
    '',
    '    @NotBlank(message = "La contraseña es requerida")',
    '    private String password;',
    '',
    '    public LoginRequestDto() {',
    '    }',
    '',
    '    public LoginRequestDto(String email, String password) {',
    '        this.email = email;',
    '        this.password = password;',
    '    }',
    '',
    '    public String getEmail() {',
    '        return email;',
    '    }',
    '',
    '    public void setEmail(String email) {',
    '        this.email = email;',
    '    }',
    '',
    '    public String getPassword() {',
    '        return password;',
    '    }',
    '',
    '    public void setPassword(String password) {',
    '        this.password = password;',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza RegisterRequestDto.
 */
export function renderRegisterRequestDto(context: ProjectContext, userClass: JavaClassMeta): string {
  const regularFields = userClass.fields.filter(
    (f) => !f.isId && f.name !== 'password',
  );

  const fieldsDefs = regularFields
    .map((f) => {
      const validation = f.javaType === 'String'
        ? `    @NotBlank(message = "El campo '${f.name}' es obligatorio")`
        : `    @NotNull(message = "El campo '${f.name}' es obligatorio")`;
      return `${validation}\n    private ${f.javaType} ${f.name};`;
    })
    .join('\n\n');

  const gettersAndSetters = regularFields
    .map((f) => [
      `    public ${f.javaType} ${f.getterName}() {`,
      `        return ${f.name};`,
      '    }',
      '',
      `    public void ${f.setterName}(${f.javaType} ${f.name}) {`,
      `        this.${f.name} = ${f.name};`,
      '    }',
    ].join('\n'))
    .join('\n\n');

  return [
    `package ${context.packageName}.dtos.auth;`,
    '',
    'import jakarta.validation.constraints.*;',
    userClass.hasDates ? 'import java.time.*;' : '',
    userClass.hasBigDecimals ? 'import java.math.BigDecimal;' : '',
    '',
    'public class RegisterRequestDto {',
    '',
    fieldsDefs,
    '',
    '    @NotBlank(message = "La contraseña es requerida")',
    '    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")',
    '    private String password;',
    '',
    '    public RegisterRequestDto() {',
    '    }',
    '',
    gettersAndSetters,
    '',
    '    public String getPassword() {',
    '        return password;',
    '    }',
    '',
    '    public void setPassword(String password) {',
    '        this.password = password;',
    '    }',
    '}',
    '',
  ].filter(Boolean).join('\n');
}

/**
 * Renderiza AuthResponseDto.
 */
export function renderAuthResponseDto(context: ProjectContext, userClass: JavaClassMeta): string {
  return [
    `package ${context.packageName}.dtos.auth;`,
    '',
    `import ${context.packageName}.dtos.${userClass.className}ResponseDto;`,
    '',
    'public class AuthResponseDto {',
    '',
    '    private String token;',
    '    private String tokenType = "Bearer";',
    `    private ${userClass.className}ResponseDto user;`,
    '',
    '    public AuthResponseDto() {',
    '    }',
    '',
    `    public AuthResponseDto(String token, ${userClass.className}ResponseDto user) {`,
    '        this.token = token;',
    '        this.tokenType = "Bearer";',
    '        this.user = user;',
    '    }',
    '',
    '    public String getToken() {',
    '        return token;',
    '    }',
    '',
    '    public void setToken(String token) {',
    '        this.token = token;',
    '    }',
    '',
    '    public String getTokenType() {',
    '        return tokenType;',
    '    }',
    '',
    '    public void setTokenType(String tokenType) {',
    '        this.tokenType = tokenType;',
    '    }',
    '',
    `    public ${userClass.className}ResponseDto getUser() {`,
    '        return user;',
    '    }',
    '',
    `    public void setUser(${userClass.className}ResponseDto user) {`,
    '        this.user = user;',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza AuthService interface.
 */
export function renderAuthServiceInterface(context: ProjectContext): string {
  return [
    `package ${context.packageName}.services;`,
    '',
    `import ${context.packageName}.dtos.auth.LoginRequestDto;`,
    `import ${context.packageName}.dtos.auth.RegisterRequestDto;`,
    `import ${context.packageName}.dtos.auth.AuthResponseDto;`,
    '',
    'public interface AuthService {',
    '',
    '    AuthResponseDto login(LoginRequestDto request);',
    '',
    '    AuthResponseDto register(RegisterRequestDto request);',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza AuthServiceImpl.
 */
export function renderAuthServiceImpl(context: ProjectContext, userClass: JavaClassMeta): string {
  const usernameField = userClass.fields.find((f) => f.name === 'email')
    ? 'Email'
    : userClass.fields.find((f) => f.name === 'username')
      ? 'Username'
      : userClass.fields[1]?.name ? userClass.fields[1].name.charAt(0).toUpperCase() + userClass.fields[1].name.slice(1) : 'Id';

  const regularFields = userClass.fields.filter(
    (f) => !f.isId && f.name !== 'password',
  );

  const fieldSetters = regularFields
    .map((f) => `        user.${f.setterName}(request.${f.getterName}());`)
    .join('\n');

  return [
    `package ${context.packageName}.services.impl;`,
    '',
    `import ${context.packageName}.services.AuthService;`,
    `import ${context.packageName}.dtos.auth.LoginRequestDto;`,
    `import ${context.packageName}.dtos.auth.RegisterRequestDto;`,
    `import ${context.packageName}.dtos.auth.AuthResponseDto;`,
    `import ${context.packageName}.dtos.${userClass.className}ResponseDto;`,
    `import ${context.packageName}.entities.${userClass.className};`,
    `import ${context.packageName}.repositories.${userClass.className}Repository;`,
    `import ${context.packageName}.security.JwtTokenProvider;`,
    'import org.springframework.security.authentication.BadCredentialsException;',
    'import org.springframework.security.crypto.password.PasswordEncoder;',
    'import org.springframework.stereotype.Service;',
    'import org.springframework.transaction.annotation.Transactional;',
    '',
    '@Service',
    '@Transactional',
    'public class AuthServiceImpl implements AuthService {',
    '',
    `    private final ${userClass.className}Repository userRepository;`,
    '    private final PasswordEncoder passwordEncoder;',
    '    private final JwtTokenProvider tokenProvider;',
    '',
    `    public AuthServiceImpl(`,
    `            ${userClass.className}Repository userRepository,`,
    '            PasswordEncoder passwordEncoder,',
    '            JwtTokenProvider tokenProvider) {',
    '        this.userRepository = userRepository;',
    '        this.passwordEncoder = passwordEncoder;',
    '        this.tokenProvider = tokenProvider;',
    '    }',
    '',
    '    @Override',
    '    public AuthResponseDto login(LoginRequestDto request) {',
    `        String identifier = request.getEmail();`,
    userClass.fields.some((f) => f.name === 'email') && userClass.fields.some((f) => f.name === 'username')
      ? `        ${userClass.className} user = userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByUsername(identifier))
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));`
      : userClass.fields.some((f) => f.name === 'email')
        ? `        ${userClass.className} user = userRepository.findByEmail(identifier)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));`
        : userClass.fields.some((f) => f.name === 'username')
          ? `        ${userClass.className} user = userRepository.findByUsername(identifier)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));`
          : `        ${userClass.className} user = userRepository.findById(java.util.UUID.fromString(identifier))
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));`,
    '',
    '        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {',
    '            throw new BadCredentialsException("Credenciales inválidas");',
    '        }',
    '',
    '        String token = tokenProvider.generateToken(request.getEmail(), user.getId());',
    `        return new AuthResponseDto(token, ${userClass.className}ResponseDto.fromEntity(user));`,
    '    }',
    '',
    '    @Override',
    '    public AuthResponseDto register(RegisterRequestDto request) {',
    `        ${userClass.className} user = new ${userClass.className}();`,
    fieldSetters,
    '        user.setPassword(passwordEncoder.encode(request.getPassword()));',
    '',
    `        ${userClass.className} saved = userRepository.save(user);`,
    '        String token = tokenProvider.generateToken(request.getEmail(), saved.getId());',
    `        return new AuthResponseDto(token, ${userClass.className}ResponseDto.fromEntity(saved));`,
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza AuthController REST.
 */
export function renderAuthController(context: ProjectContext, userClass: JavaClassMeta): string {
  return [
    `package ${context.packageName}.controllers;`,
    '',
    `import ${context.packageName}.services.AuthService;`,
    `import ${context.packageName}.dtos.auth.LoginRequestDto;`,
    `import ${context.packageName}.dtos.auth.RegisterRequestDto;`,
    `import ${context.packageName}.dtos.auth.AuthResponseDto;`,
    'import io.swagger.v3.oas.annotations.Operation;',
    'import io.swagger.v3.oas.annotations.tags.Tag;',
    'import jakarta.validation.Valid;',
    'import org.springframework.http.HttpStatus;',
    'import org.springframework.http.ResponseEntity;',
    'import org.springframework.web.bind.annotation.*;',
    '',
    '@RestController',
    '@RequestMapping("/api/v1/auth")',
    '@Tag(name = "Autenticación", description = "Endpoints para inicio de sesión, registro y gestión de JWT")',
    'public class AuthController {',
    '',
    '    private final AuthService authService;',
    '',
    '    public AuthController(AuthService authService) {',
    '        this.authService = authService;',
    '    }',
    '',
    '    @PostMapping("/login")',
    '    @Operation(summary = "Iniciar sesión y obtener token JWT")',
    '    public ResponseEntity<AuthResponseDto> login(@Valid @RequestBody LoginRequestDto request) {',
    '        return ResponseEntity.ok(authService.login(request));',
    '    }',
    '',
    '    @PostMapping("/register")',
    '    @ResponseStatus(HttpStatus.CREATED)',
    '    @Operation(summary = "Registrar un nuevo usuario")',
    '    public ResponseEntity<AuthResponseDto> register(@Valid @RequestBody RegisterRequestDto request) {',
    '        return new ResponseEntity<>(authService.register(request), HttpStatus.CREATED);',
    '    }',
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza DataInitializer para sembrar el usuario administrador automáticamente en el arranque.
 */
export function renderDataInitializer(context: ProjectContext, userClass: JavaClassMeta): string {
  const fields = userClass.fields.filter((f) => !f.isId && f.name !== 'password');
  const setters: string[] = [];

  for (const f of fields) {
    if (f.name.toLowerCase() === 'email' || f.name.toLowerCase() === 'correo') {
      setters.push(`            admin.${f.setterName}("admin@studio.com");`);
    } else if (f.name.toLowerCase().includes('rol') || f.name.toLowerCase().includes('role')) {
      setters.push(`            admin.${f.setterName}("ADMIN");`);
    } else if (f.name.toLowerCase() === 'username' || f.name.toLowerCase() === 'usuario') {
      setters.push(`            admin.${f.setterName}("admin");`);
    } else if (f.name.toLowerCase().includes('nombre') || f.name.toLowerCase().includes('name')) {
      setters.push(`            admin.${f.setterName}("Administrador");`);
    } else if (f.name.toLowerCase().includes('telefono') || f.name.toLowerCase().includes('phone')) {
      setters.push(`            admin.${f.setterName}("70000000");`);
    } else if (f.name.toLowerCase().includes('nit') || f.name.toLowerCase().includes('ci') || f.name.toLowerCase().includes('documento')) {
      setters.push(`            admin.${f.setterName}("1234567");`);
    } else if (f.javaType === 'String') {
      setters.push(`            admin.${f.setterName}("${f.name}_admin");`);
    } else if (
      f.javaType === 'Integer' ||
      f.javaType === 'Long' ||
      f.javaType === 'Double' ||
      f.javaType === 'BigDecimal'
    ) {
      setters.push(`            admin.${f.setterName}(0);`);
    } else if (f.javaType === 'Boolean') {
      setters.push(`            admin.${f.setterName}(true);`);
    }
  }

  return [
    `package ${context.packageName}.security;`,
    '',
    `import ${context.packageName}.entities.${userClass.className};`,
    `import ${context.packageName}.repositories.${userClass.className}Repository;`,
    'import org.springframework.boot.CommandLineRunner;',
    'import org.springframework.security.crypto.password.PasswordEncoder;',
    'import org.springframework.stereotype.Component;',
    '',
    '/**',
    ' * Inicializador automático de datos en el arranque de la aplicación.',
    ' * Garantiza que siempre exista al menos un usuario administrador listo para usar.',
    ' */',
    '@Component',
    'public class DataInitializer implements CommandLineRunner {',
    '',
    `    private final ${userClass.className}Repository userRepository;`,
    '    private final PasswordEncoder passwordEncoder;',
    '',
    `    public DataInitializer(${userClass.className}Repository userRepository, PasswordEncoder passwordEncoder) {`,
    '        this.userRepository = userRepository;',
    '        this.passwordEncoder = passwordEncoder;',
    '    }',
    '',
    '    @Override',
    '    public void run(String... args) throws Exception {',
    '        userRepository.findByEmail("admin@studio.com").ifPresentOrElse(',
    '            admin -> {',
    '                admin.setPassword(passwordEncoder.encode("admin123"));',
    '                userRepository.save(admin);',
    '                System.out.println(">>> [DataInitializer] Contraseña del usuario administrador sincronizada: admin@studio.com / admin123");',
    '            },',
    '            () -> {',
    `                ${userClass.className} admin = new ${userClass.className}();`,
    ...setters,
    '                admin.setPassword(passwordEncoder.encode("admin123"));',
    '                userRepository.save(admin);',
    '                System.out.println("==================================================================");',
    '                System.out.println(" [DataInitializer] Usuario administrador inicial creado con éxito:");',
    '                System.out.println("   - Email: admin@studio.com");',
    '                System.out.println("   - Password: admin123");',
    '                System.out.println("==================================================================");',
    '            }',
    '        );',
    '    }',
    '}',
    '',
  ].join('\n');
}
