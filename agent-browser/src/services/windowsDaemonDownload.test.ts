import { describe, expect, it } from 'vitest';

import { resolveLocalInferenceDaemonDownload } from './windowsDaemonDownload';

describe('Windows daemon download detection', () => {
  it('selects the Windows x64 daemon executable for x86_64 Windows navigators', async () => {
    await expect(resolveLocalInferenceDaemonDownload({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      userAgentData: {
        platform: 'Windows',
        getHighEntropyValues: async () => ({ platform: 'Windows', architecture: 'x86', bitness: '64' }),
      },
    })).resolves.toEqual({
      href: '/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
      fileName: 'agent-harness-local-inference-daemon-windows-x64.exe',
      label: 'Windows x64',
    });
  });

  it('falls back to the portable source bundle for arm64 Windows navigators', async () => {
    await expect(resolveLocalInferenceDaemonDownload({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; ARM64)',
      userAgentData: {
        platform: 'Windows',
        getHighEntropyValues: async () => ({ platform: 'Windows', architecture: 'arm', bitness: '64' }),
      },
    })).resolves.toEqual({
      href: '/downloads/agent-harness-local-inference-daemon.zip',
      fileName: 'agent-harness-local-inference-daemon.zip',
      label: 'Portable Deno source',
    });
  });

  it('falls back to the portable source bundle for non-Windows navigators', async () => {
    await expect(resolveLocalInferenceDaemonDownload({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      userAgentData: {
        platform: 'Linux',
        getHighEntropyValues: async () => ({ platform: 'Linux', architecture: 'x86', bitness: '64' }),
      },
    })).resolves.toEqual({
      href: '/downloads/agent-harness-local-inference-daemon.zip',
      fileName: 'agent-harness-local-inference-daemon.zip',
      label: 'Portable Deno source',
    });
  });

  it('falls back to the portable source bundle for unsupported 32-bit Windows navigators', async () => {
    await expect(resolveLocalInferenceDaemonDownload({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW32)',
      userAgentData: {
        platform: 'Windows',
        getHighEntropyValues: async () => ({ platform: 'Windows', architecture: 'x86', bitness: '32' }),
      },
    })).resolves.toEqual({
      href: '/downloads/agent-harness-local-inference-daemon.zip',
      fileName: 'agent-harness-local-inference-daemon.zip',
      label: 'Portable Deno source',
    });
  });

  it('uses UA heuristics when high entropy lookup rejects', async () => {
    await expect(resolveLocalInferenceDaemonDownload({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      userAgentData: {
        platform: 'Windows',
        getHighEntropyValues: async () => { throw new Error('unsupported'); },
      },
    })).resolves.toEqual({
      href: '/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
      fileName: 'agent-harness-local-inference-daemon-windows-x64.exe',
      label: 'Windows x64',
    });
  });

  it('falls back to the portable source bundle for 32-bit Windows without UA-CH', async () => {
    await expect(resolveLocalInferenceDaemonDownload({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win32; x86)',
    })).resolves.toEqual({
      href: '/downloads/agent-harness-local-inference-daemon.zip',
      fileName: 'agent-harness-local-inference-daemon.zip',
      label: 'Portable Deno source',
    });
  });
});
