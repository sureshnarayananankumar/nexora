export interface Config {
  port: number;
  jwtSecret: string;
  redisUrl: string | null;
  apiUrl: string;
  corsOrigins: string[];
  stream: string;
  group: string;
  consumer: string;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 bytes long');
  }
  const redisHost = env.REDIS_HOST;
  const redisUrl = env.REDIS_URL
    ?? (redisHost
      ? `redis://${env.REDIS_PASSWORD ? `:${encodeURIComponent(env.REDIS_PASSWORD)}@` : ''}${redisHost}:${env.REDIS_PORT ?? '6379'}`
      : null);
  return {
    port: Number(env.PORT ?? 4000),
    jwtSecret,
    redisUrl,
    apiUrl: (env.API_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4200').split(',').map((s) => s.trim()).filter(Boolean),
    stream: env.EVENTS_STREAM ?? 'nexora:events',
    group: env.EVENTS_GROUP ?? 'realtime',
    consumer: env.EVENTS_CONSUMER ?? `rt-${process.pid}`,
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
