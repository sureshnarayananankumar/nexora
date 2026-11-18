/** A message read from the Redis Stream written by the API's RealtimeEventRelay. */
export interface StreamEvent {
  type: string;
  orgId: number | null;
  projectId: number | null;
  userIds: number[];
  orgWide: boolean;
  payload: unknown;
  emittedAt: string;
}

export function parseStreamFields(fields: string[]): StreamEvent {
  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) map[fields[i]] = fields[i + 1];
  if (!map.type) throw new Error('Stream entry without type');
  const num = (v: string | undefined) => (v && v.length ? Number(v) : null);
  let payload: unknown = null;
  try {
    payload = map.payload ? JSON.parse(map.payload) : null;
  } catch {
    payload = null;
  }
  return {
    type: map.type,
    orgId: num(map.orgId),
    projectId: num(map.projectId),
    userIds: (map.userIds ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite),
    orgWide: map.orgWide === 'true',
    payload,
    emittedAt: map.emittedAt ?? new Date().toISOString(),
  };
}

/** Socket.IO rooms an event must reach. Never broadcasts globally. */
export function roomsFor(e: StreamEvent): string[] {
  const rooms: string[] = [];
  if (e.projectId != null) rooms.push(`project:${e.projectId}`);
  for (const id of e.userIds) rooms.push(`user:${id}`);
  if (e.orgWide && e.orgId != null) rooms.push(`org:${e.orgId}`);
  return rooms;
}
