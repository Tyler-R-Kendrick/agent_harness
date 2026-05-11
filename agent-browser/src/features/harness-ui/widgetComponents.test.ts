import { describe, expect, it } from 'vitest';

import {
  assertWidgetNodeAllowedByCatalog,
  createDefaultWidgetDocument,
  getDefaultWidgetComponent,
  listDefaultWidgetComponents,
} from './widgetComponents';

describe('widget component catalog', () => {
  it('defines the shared default components used by design systems and widgets', () => {
    const catalog = listDefaultWidgetComponents();
    const types = catalog.map((entry) => entry.type);

    expect(types).toEqual(expect.arrayContaining([
      'Card',
      'Box',
      'Row',
      'Col',
      'Title',
      'Text',
      'Badge',
      'Button',
      'Image',
      'ListView',
      'ListViewItem',
      'Markdown',
      'Select',
      'Spacer',
    ]));
    expect(catalog.every((entry) => entry.designTokens.length > 0)).toBe(true);
    expect(catalog.every((entry) => entry.designSystemBindings.length > 0)).toBe(true);
    expect(getDefaultWidgetComponent('Text')).toMatchObject({
      adaptiveCardAnalog: 'TextBlock',
      designSystemBindings: expect.arrayContaining(['typography.body', 'color.text']),
    });
  });

  it('creates a JSON widget document and rejects uncataloged or unsafe nodes', () => {
    const document = createDefaultWidgetDocument('Session summary');

    expect(document).toMatchObject({
      type: 'Card',
      size: 'md',
    });
    expect(document.children?.[0]).toMatchObject({ type: 'Title', value: 'Session summary' });
    expect(document.children?.[1]).toMatchObject({ type: 'Text' });
    expect(document.children?.[2]).toMatchObject({ type: 'Row' });
    expect(() => assertWidgetNodeAllowedByCatalog(document)).not.toThrow();
    expect(() => assertWidgetNodeAllowedByCatalog({
      type: 'RawHtml',
      html: '<script>alert(1)</script>',
    })).toThrow(/catalog/);
    expect(() => assertWidgetNodeAllowedByCatalog({
      type: 'Text',
      value: 'Hello',
      style: 'color:red',
    })).toThrow(/style/);
  });
});
