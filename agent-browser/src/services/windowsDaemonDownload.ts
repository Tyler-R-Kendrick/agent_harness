export interface NavigatorLike {
  userAgent?: string;
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{
      platform?: string;
      architecture?: string;
      bitness?: string;
      wow64?: boolean;
    }>;
  };
}

export interface DaemonDownloadChoice {
  href: string;
  fileName: string;
  label: string;
}

export const PORTABLE_DAEMON_SOURCE_DOWNLOAD: DaemonDownloadChoice = {
  href: '/downloads/agent-harness-local-inference-daemon.zip',
  fileName: 'agent-harness-local-inference-daemon.zip',
  label: 'Portable Deno source',
};

const WINDOWS_X64_DAEMON_DOWNLOAD: DaemonDownloadChoice = {
  href: '/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
  fileName: 'agent-harness-local-inference-daemon-windows-x64.exe',
  label: 'Windows x64',
};

const WINDOWS_ARM64_DAEMON_DOWNLOAD: DaemonDownloadChoice = {
  href: '/downloads/agent-harness-local-inference-daemon-windows-arm64.exe',
  fileName: 'agent-harness-local-inference-daemon-windows-arm64.exe',
  label: 'Windows ARM64',
};

export async function resolveLocalInferenceDaemonDownload(navigatorLike: NavigatorLike): Promise<DaemonDownloadChoice> {
  const platform = navigatorLike.userAgentData?.platform ?? navigatorLike.userAgent ?? '';
  if (!/windows/i.test(platform)) return PORTABLE_DAEMON_SOURCE_DOWNLOAD;

  const highEntropy = await navigatorLike.userAgentData?.getHighEntropyValues?.([
    'architecture',
    'bitness',
    'platform',
    'platformVersion',
    'wow64',
  ]);
  const architecture = highEntropy?.architecture?.toLowerCase() ?? navigatorLike.userAgent?.toLowerCase() ?? '';
  const bitness = highEntropy?.bitness ?? '';
  if (architecture.includes('arm') || /arm64|aarch64/i.test(navigatorLike.userAgent ?? '')) {
    return WINDOWS_ARM64_DAEMON_DOWNLOAD;
  }
  if (architecture.includes('x86') && bitness === '32') return PORTABLE_DAEMON_SOURCE_DOWNLOAD;
  return WINDOWS_X64_DAEMON_DOWNLOAD;
}
