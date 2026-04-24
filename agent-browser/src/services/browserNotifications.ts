export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export type BrowserNotificationSettings = {
  enabled: boolean;
};

export type BrowserNotificationEvent = {
  id: string;
  title: string;
  body: string;
};

export type BrowserNotificationResult =
  | 'sent'
  | 'disabled'
  | 'unsupported'
  | 'permission-denied'
  | 'duplicate'
  | 'error';

export type BrowserNotificationApi = {
  readonly permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, options: NotificationOptions) => void;
};

export type BrowserNotificationDispatcher = {
  notify: (event: BrowserNotificationEvent) => BrowserNotificationResult;
};

export const DEFAULT_BROWSER_NOTIFICATION_SETTINGS: BrowserNotificationSettings = {
  enabled: false,
};

const MAX_NOTIFICATION_BODY_LENGTH = 120;
const ELICITATION_PATTERNS = [
  /\?(\s|$)/,
  /\bplease\s+(choose|confirm|approve|review|decide|select|pick|respond|reply|provide)\b/i,
  /\b(can|may|should)\s+i\b/i,
  /\bneed(?:s)?\s+(your\s+)?(input|approval|permission|confirmation|decision)\b/i,
  /\bchoose\s+(one|between|option)\b/i,
  /\bwaiting\s+for\s+(you|your|user)\b/i,
];

export function isBrowserNotificationSettings(value: unknown): value is BrowserNotificationSettings {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as BrowserNotificationSettings).enabled === 'boolean'
  );
}

export function createBrowserNotificationApi(notificationCtor: typeof Notification | undefined): BrowserNotificationApi | null {
  if (!notificationCtor) return null;
  return {
    get permission() {
      return notificationCtor.permission;
    },
    requestPermission: () => notificationCtor.requestPermission(),
    showNotification: (title, options) => {
      void new notificationCtor(title, options);
    },
  };
}

export function getBrowserNotificationPermission(api: BrowserNotificationApi | null | undefined): BrowserNotificationPermission {
  return api ? api.permission : 'unsupported';
}

export async function requestBrowserNotificationPermission(api: BrowserNotificationApi | null | undefined): Promise<BrowserNotificationPermission> {
  if (!api) return 'unsupported';
  return api.requestPermission();
}

export function createBrowserNotificationDispatcher({
  api,
  getSettings,
}: {
  api: BrowserNotificationApi | null | undefined;
  getSettings: () => BrowserNotificationSettings;
}): BrowserNotificationDispatcher {
  const sentEventIds = new Set<string>();

  return {
    notify(event) {
      if (!getSettings().enabled) return 'disabled';
      if (!api) return 'unsupported';
      if (api.permission !== 'granted') return 'permission-denied';
      if (sentEventIds.has(event.id)) return 'duplicate';

      sentEventIds.add(event.id);
      try {
        api.showNotification(event.title, {
          body: event.body,
          tag: event.id,
        });
        return 'sent';
      } catch {
        sentEventIds.delete(event.id);
        return 'error';
      }
    },
  };
}

export function isLikelyUserElicitation(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return ELICITATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildChatCompletionNotification({
  eventId,
  sessionName,
  content,
}: {
  eventId: string;
  sessionName: string;
  content: string;
}): BrowserNotificationEvent {
  return {
    id: eventId,
    title: 'Session work complete',
    body: formatBody(sessionName, content),
  };
}

export function buildChatElicitationNotification({
  eventId,
  sessionName,
  content,
}: {
  eventId: string;
  sessionName: string;
  content: string;
}): BrowserNotificationEvent {
  return {
    id: eventId,
    title: 'Agent needs input',
    body: formatBody(sessionName, content),
  };
}

function formatBody(sessionName: string, content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  const preview = collapsed.length > MAX_NOTIFICATION_BODY_LENGTH
    ? `${collapsed.slice(0, MAX_NOTIFICATION_BODY_LENGTH - 1).trimEnd()}...`
    : collapsed;
  return `${sessionName}: ${preview || 'Work finished.'}`;
}
