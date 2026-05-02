import { describe, expect, it } from 'vitest';
import {
  buildCenteredFirstFitLayout,
  findFirstFitWidgetPlacement,
  normalizeWidgetPosition,
  normalizeWidgetSize,
  resolveSpaceLayout,
} from './spaceLayout';

describe('harness space layout', () => {
  it('normalizes widget sizes using Space Agent-compatible presets and clamps', () => {
    expect(normalizeWidgetSize('small')).toEqual({ cols: 4, rows: 2, preset: 'small' });
    expect(normalizeWidgetSize('8x4')).toEqual({ cols: 8, rows: 4 });
    expect(normalizeWidgetSize([2, 5])).toEqual({ cols: 2, rows: 5 });
    expect(normalizeWidgetSize({ width: 99, height: -4 })).toEqual({ cols: 24, rows: 1 });
  });

  it('normalizes signed widget positions without losing negative coordinates', () => {
    expect(normalizeWidgetPosition('-3,8')).toEqual({ col: -3, row: 8 });
    expect(normalizeWidgetPosition([4, -2])).toEqual({ col: 4, row: -2 });
    expect(normalizeWidgetPosition({ x: -99, y: 12 })).toEqual({ col: -99, row: 12 });
  });

  it('moves colliding widgets into the first available open cell', () => {
    const layout = resolveSpaceLayout({
      widgetIds: ['a', 'b', 'c'],
      widgetPositions: {
        a: { col: 0, row: 0 },
        b: { col: 0, row: 0 },
        c: { col: 1, row: 0 },
      },
      widgetSizes: {
        a: { cols: 2, rows: 2 },
        b: { cols: 2, rows: 1 },
        c: { cols: 1, rows: 1 },
      },
    });

    expect(layout.positions.a).toEqual({ col: 0, row: 0 });
    expect(layout.positions.b).toEqual({ col: 2, row: 0 });
    expect(layout.positions.c).toEqual({ col: 4, row: 0 });
  });

  it('packs widgets around the centered origin without overlap', () => {
    const layout = buildCenteredFirstFitLayout({
      viewportCols: 12,
      widgetIds: ['a', 'b', 'c'],
      widgetSizes: {
        a: { cols: 6, rows: 3 },
        b: { cols: 4, rows: 2 },
        c: { cols: 4, rows: 2 },
      },
    });

    expect(layout.positions).toEqual({
      a: { col: -5, row: -2 },
      b: { col: 1, row: -2 },
      c: { col: 1, row: 0 },
    });
  });

  it('places new widgets into the first open slot in the existing packed span', () => {
    expect(findFirstFitWidgetPlacement({
      viewportCols: 12,
      widgetSize: { cols: 3, rows: 2 },
      existingWidgetPositions: {
        a: { col: -5, row: -2 },
        b: { col: -2, row: -2 },
        c: { col: 1, row: -2 },
      },
      existingWidgetSizes: {
        a: { cols: 3, rows: 2 },
        b: { cols: 3, rows: 2 },
        c: { cols: 3, rows: 2 },
      },
    })).toEqual({ col: 4, row: -2 });
  });
});
