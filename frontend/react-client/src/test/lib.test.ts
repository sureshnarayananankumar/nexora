import { addDays, format } from 'date-fns';
import { dueLabel, initials, positionBetween } from '../lib/format';
import { localValidate } from '../pages/workflows/WorkflowBuilderPage';
import type { CatalogKind } from '../api/types';

describe('board ordering', () => {
  it('places cards between, before and after neighbours', () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(undefined, 1024)).toBe(0);
    expect(positionBetween(2048, undefined)).toBe(3072);
    expect(positionBetween()).toBe(1024);
  });
});

describe('formatting', () => {
  const iso = (d: number) => format(addDays(new Date(), d), 'yyyy-MM-dd');
  it('labels due dates relative to today', () => {
    expect(dueLabel(iso(-2))).toEqual({ text: '2d overdue', tone: 'danger' });
    expect(dueLabel(iso(0))?.text).toBe('Due today');
    expect(dueLabel(iso(1))?.text).toBe('Tomorrow');
    expect(dueLabel(iso(-2), true)?.tone).toBe('muted');
    expect(dueLabel(undefined)).toBeNull();
  });
  it('builds initials', () => {
    expect(initials('Mei Tanaka')).toBe('MT');
    expect(initials('  sarah  ')).toBe('S');
  });
});

describe('workflow client validation (mirrors GraphValidator)', () => {
  const kinds: CatalogKind[] = [
    { type: 'TRIGGER', kind: 'TASK_CREATED', label: 'Task created', description: '', fields: [] },
    { type: 'ACTION', kind: 'SET_PRIORITY', label: 'Set priority', description: '', fields: [{ name: 'priority', type: 'priority', required: true, label: 'Priority' }] },
  ];
  it('accepts a connected trigger → action graph', () => {
    const errs = localValidate('ok', [
      { key: 't', type: 'TRIGGER', kind: 'TASK_CREATED', label: 'T', config: {}, x: 0, y: 0 },
      { key: 'a', type: 'ACTION', kind: 'SET_PRIORITY', label: 'A', config: { priority: 'HIGH' }, x: 0, y: 0 },
    ], [{ source: 't', target: 'a' }], kinds);
    expect(errs).toEqual([]);
  });
  it('reports missing config, unreachable blocks and missing triggers', () => {
    const errs = localValidate('', [
      { key: 'a', type: 'ACTION', kind: 'SET_PRIORITY', label: 'A', config: {}, x: 0, y: 0 },
    ], [], kinds);
    expect(errs).toEqual(expect.arrayContaining([
      'Give the workflow a name',
      'A workflow needs exactly one trigger (found 0)',
      '“A” needs a value for Priority',
    ]));
  });
});
