package com.nexora.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.config.NexoraProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Writes realtime events to a Redis Stream only after the surrounding transaction commits,
 * so clients never see changes that were rolled back. Redis being down never breaks the API.
 */
@Component
public class RealtimeEventRelay {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventRelay.class);
    private static final long MAX_STREAM_LENGTH = 10_000;

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final String stream;

    public RealtimeEventRelay(StringRedisTemplate redis, ObjectMapper mapper, NexoraProperties props) {
        this.redis = redis;
        this.mapper = mapper;
        this.stream = props.eventsStream() == null ? "nexora:events" : props.eventsStream();
    }

    @TransactionalEventListener(fallbackExecution = true)
    public void relay(RealtimeEvent event) {
        try {
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("type", event.type());
            fields.put("orgId", event.organizationId() == null ? "" : String.valueOf(event.organizationId()));
            fields.put("projectId", event.projectId() == null ? "" : String.valueOf(event.projectId()));
            fields.put("userIds", event.userIds().stream().map(String::valueOf).collect(Collectors.joining(",")));
            fields.put("orgWide", String.valueOf(event.orgWide()));
            fields.put("payload", mapper.writeValueAsString(event.payload()));
            fields.put("emittedAt", Instant.now().toString());
            MapRecord<String, String, String> record = StreamRecords.newRecord().in(stream).ofMap(fields);
            redis.opsForStream().add(record);
        } catch (JsonProcessingException e) {
            log.error("Could not serialise realtime event {}", event.type(), e);
        } catch (RuntimeException e) {
            log.warn("Realtime event {} not published (Redis unavailable?): {}", event.type(), e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 600_000, initialDelay = 60_000)
    public void trim() {
        try {
            redis.opsForStream().trim(stream, MAX_STREAM_LENGTH, true);
        } catch (RuntimeException e) {
            log.debug("Stream trim skipped: {}", e.getMessage());
        }
    }
}
