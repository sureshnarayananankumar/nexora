# syntax=docker/dockerfile:1.7
# ── NEXORA API (Spring Boot 3.5, Java 21) · build context: repository root ──
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/springboot-api/pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline
COPY backend/springboot-api/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S nexora && adduser -S nexora -G nexora && apk add --no-cache wget
WORKDIR /app
COPY --from=build /src/target/nexora-api.jar app.jar
COPY database/migrations ./migrations
USER nexora
ENV FLYWAY_LOCATIONS=filesystem:/app/migrations \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/urandom"
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
