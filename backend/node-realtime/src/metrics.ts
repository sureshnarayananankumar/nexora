/** In-process counters exposed on /metrics (JSON) for the admin console and health checks. */
export class Metrics {
  readonly startedAt = Date.now();
  connections = 0;
  peakConnections = 0;
  eventsProcessed = 0;
  eventsFailed = 0;
  lastEventAt: string | null = null;
  readonly byType = new Map<string, number>();
  private readonly perMinute: number[] = new Array(60).fill(0);
  private minuteCursor = Math.floor(Date.now() / 60_000);

  connected() {
    this.connections++;
    this.peakConnections = Math.max(this.peakConnections, this.connections);
  }

  disconnected() {
    this.connections = Math.max(0, this.connections - 1);
  }

  event(type: string) {
    this.rotate();
    this.eventsProcessed++;
    this.lastEventAt = new Date().toISOString();
    this.byType.set(type, (this.byType.get(type) ?? 0) + 1);
    this.perMinute[this.minuteCursor % 60]++;
  }

  failed() {
    this.eventsFailed++;
  }

  private rotate() {
    const now = Math.floor(Date.now() / 60_000);
    while (this.minuteCursor < now) {
      this.minuteCursor++;
      this.perMinute[this.minuteCursor % 60] = 0;
    }
  }

  snapshot() {
    this.rotate();
    const lastHour = this.perMinute.reduce((a, b) => a + b, 0);
    return {
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      connections: this.connections,
      peakConnections: this.peakConnections,
      eventsProcessed: this.eventsProcessed,
      eventsFailed: this.eventsFailed,
      eventsLastHour: lastHour,
      eventsLastMinute: this.perMinute[this.minuteCursor % 60],
      lastEventAt: this.lastEventAt,
      byType: Object.fromEntries([...this.byType.entries()].sort((a, b) => b[1] - a[1])),
    };
  }
}
