import { Redis } from 'ioredis';
import { pino } from 'pino';
import { loadConfig } from './config.js';
import { createRealtimeServer } from './server.js';
import { MemoryPresence, RedisPresence, type PresenceStore } from './presence.js';
import { apiAccessChecker } from './access.js';
import { StreamConsumer } from './streamConsumer.js';

const config = loadConfig();
const log = pino({ level: config.logLevel, base: { service: 'nexora-realtime' } });

let redis: Redis | null = null;
let presence: PresenceStore = new MemoryPresence();
if (config.redisUrl) {
  redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  redis.on('error', (err) => log.warn({ err: err.message }, 'redis error'));
  presence = new RedisPresence(redis);
} else {
  log.warn('REDIS_HOST not set: using in-memory presence and no event stream (development only)');
}

const server = createRealtimeServer({
  jwtSecret: config.jwtSecret,
  corsOrigins: config.corsOrigins,
  presence,
  canAccessProject: apiAccessChecker(config.apiUrl),
  log,
  isReady: () => !redis || redis.status === 'ready',
});

let consumer: StreamConsumer | null = null;
if (redis) {
  // A dedicated connection: XREADGROUP BLOCK would otherwise stall presence commands.
  const streamConn = redis.duplicate();
  consumer = new StreamConsumer(streamConn, config.stream, config.group, config.consumer,
    (e) => server.dispatch(e), log, () => server.metrics.failed());
  consumer.start().catch((err) => log.error({ err }, 'could not start stream consumer'));
}

server.http.listen(config.port, () => log.info({ port: config.port }, 'realtime service listening'));

const shutdown = async (signal: string) => {
  log.info({ signal }, 'shutting down');
  await consumer?.stop();
  await server.close();
  redis?.disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
