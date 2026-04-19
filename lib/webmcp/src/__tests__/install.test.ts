import { JSDOM } from 'jsdom';

import { installModelContext } from '../install';
import { ModelContext } from '../modelContext';

describe('installModelContext', () => {
  it('returns undefined when no target is available', () => {
    expect(installModelContext(null as unknown as Window)).toBeUndefined();
  });

  it('returns undefined when the target has no navigator', () => {
    const target = { location: { hostname: 'example.com', protocol: 'https:' } } as unknown as Window;

    expect(installModelContext(target)).toBeUndefined();
  });

  it('does not install in non-secure contexts', () => {
    const dom = new JSDOM('', { url: 'http://example.com' });

    expect(installModelContext(dom.window as unknown as Window)).toBeUndefined();
    expect('modelContext' in dom.window.navigator).toBe(false);
  });

  it('respects an explicit false isSecureContext value', () => {
    const target = {
      isSecureContext: false,
      location: { hostname: 'example.com', protocol: 'https:' },
      navigator: {},
    } as unknown as Window;

    expect(installModelContext(target)).toBeUndefined();
  });

  it('respects an explicit true isSecureContext value', () => {
    const navigatorObject = {} as Navigator;
    const target = {
      isSecureContext: true,
      location: { hostname: 'example.com', protocol: 'http:' },
      navigator: navigatorObject,
    } as unknown as Window;

    const installed = installModelContext(target);

    expect(installed).toBeInstanceOf(ModelContext);
    expect((navigatorObject as Navigator & { modelContext?: ModelContext }).modelContext).toBe(installed);
  });

  it('installs into loopback targets even without isSecureContext metadata', () => {
    const navigatorObject = {} as Navigator;
    const target = {
      location: { hostname: 'localhost', protocol: 'http:' },
      navigator: navigatorObject,
    } as unknown as Window;

    const installed = installModelContext(target);

    expect(installed).toBeInstanceOf(ModelContext);
    expect((navigatorObject as Navigator & { modelContext?: ModelContext }).modelContext).toBe(installed);
  });

  it('installs into https targets even without isSecureContext metadata', () => {
    const navigatorObject = {} as Navigator;
    const target = {
      location: { hostname: 'example.com', protocol: 'https:' },
      navigator: navigatorObject,
    } as unknown as Window;

    const installed = installModelContext(target);

    expect(installed).toBeInstanceOf(ModelContext);
    expect((navigatorObject as Navigator & { modelContext?: ModelContext }).modelContext).toBe(installed);
  });

  it('uses the ambient window when no target is provided', () => {
    delete (window.navigator as Navigator & { modelContext?: ModelContext }).modelContext;

    const installed = installModelContext();

    expect(installed).toBeInstanceOf(ModelContext);
    expect((window.navigator as Navigator & { modelContext?: ModelContext }).modelContext).toBe(installed);
  });

  it('returns undefined when no ambient window exists', () => {
    vi.stubGlobal('window', undefined);

    expect(installModelContext()).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('returns the same object on repeated installs', () => {
    const dom = new JSDOM('', { url: 'https://example.com' });

    const first = installModelContext(dom.window as unknown as Window);
    const second = installModelContext(dom.window as unknown as Window);

    expect(first).toBeInstanceOf(ModelContext);
    expect(second).toBe(first);
    expect((dom.window.navigator as Navigator & { modelContext?: ModelContext }).modelContext).toBe(first);
  });

  it('leaves a pre-existing modelContext untouched', () => {
    const dom = new JSDOM('', { url: 'https://example.com' });
    const existing = new ModelContext();

    Object.defineProperty(dom.window.navigator, 'modelContext', {
      configurable: true,
      enumerable: true,
      value: existing,
    });

    expect(installModelContext(dom.window as unknown as Window)).toBe(existing);
  });

  it('replaces a foreign modelContext with the compatible polyfill instance', () => {
    const dom = new JSDOM('', { url: 'https://example.com' });
    const foreignModelContext = { source: 'browser-native' };

    Object.defineProperty(dom.window.navigator, 'modelContext', {
      configurable: true,
      enumerable: true,
      value: foreignModelContext,
    });

    const installed = installModelContext(dom.window as unknown as Window);
    const repeated = installModelContext(dom.window as unknown as Window);

    expect(installed).toBeInstanceOf(ModelContext);
    expect(repeated).toBe(installed);
    expect((dom.window.navigator as Navigator & { modelContext?: unknown }).modelContext).toBe(installed);
    expect(installed).not.toBe(foreignModelContext);
  });
});