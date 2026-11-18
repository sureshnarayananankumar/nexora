import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { parseStreamFields, type StreamEvent } from './router.js';

type StreamReply = [string, [string, string[]][]][] | null;

/**
 * Reliable consumer for the API's event stream (Redis Streams consumer group).
 * Each entry is acknowledged only after it was handed to Socket.IO, so a crash re-delivers it.
 */
export class StreamConsumer {
  private running = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly stream: string,
    private readonly group: string,
    private readonly consumer: string,
    private readonly handle: (e: StreamEvent) => void,
    private readonly log: Logger,
    private readonly onFailure: () => void = () => {},
  ) {}

  async start() {
    try {
      await this.redis.xgroup('CREATE', this.stream, this.group, '$', 'MKSTREAM');
      this.log.info({ stream: this.stream, group: this.group }, 'created consumer group');
    } catch (e) {
      if (!String((e as Error).message).includes('BUSYGROUP')) throw e;
    }
    this.running = true;
    this.loop = this.run();
  }

  async stop() {
    this.running = false;
    await this.loop?.catch(() => undefined);
  }

  private async run() {
    // First drain anything delivered to this consumer but never acknowledged (e.g. after a crash).
    let cursor = '0';
    while (this.running) {
      try {
        const reply = (await this.redis.xreadgroup(
          'GROUP', this.group, this.consumer,
          'COUNT', 100, 'BLOCK', 5000,
          'STREAMS', this.stream, cursor,
        )) as StreamReply;
        const entries = reply?.[0]?.[1] ?? [];
        if (cursor === '0' && entries.length === 0) {
          cursor = '>';
          continue;
        }
        for (const [id, fields] of entries) {
          try {
            this.handle(parseStreamFields(fields));
          } catch (err) {
            this.onFailure();
            this.log.warn({ err, id }, 'could not process stream entry; acknowledging to avoid a poison loop');
          }
          await this.redis.xack(this.stream, this.group, id);
        }
      } catch (err) {
        if (!this.running) break;
        this.log.error({ err }, 'stream read failed; retrying in 2s');
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}
