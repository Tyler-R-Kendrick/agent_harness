import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BROWSER_NOTIFICATION_SETTINGS,
  buildChatCompletionNotification,
  buildChatElicitationNotification,
  createBrowserNotificationDispatcher,
  getBrowserNotificationPermission,
  isBrowserNotificationSettings,
  isLikelyUserElicitation,
  requestBrowserNotificationPermission,
  type BrowserNotificationApi,
} from './browserNotifications';

function createApi(permission: NotificationPermission = 'granted') {
  let currentPermission = permission;
  const api: BrowserNotificationApi = {
    get permission() {
      return currentPermission;
    },
    requestPermission: vi.fn(async () => {
      currentPermission = 'granted';
      return currentPermission;
    }),
    showNotification: vi.fn(),
  };
  return api;
}

describe('browserNotifications', () => {
  it('validates persisted settings', () => {
    expect(DEFAULT_BROWSER_NOTIFICATION_SETTINGS).toEqual({ enabled: false });
    expect(isBrowserNotificationSettings({ enabled: true })).toBe(true);
    expect(isBrowserNotificationSettings({ enabled: false })).toBe(true);
    expect(isBrowserNotificationSettings({ enabled: 'yes' })).toBe(false);
    expect(isBrowserNotificationSettings(null)).toBe(false);
  });

  it('reports unsupported notification APIs without throwing', () => {
    expect(getBrowserNotificationPermission(null)).toBe('unsupported');
    expect(getBrowserNotificationPermission(undefined)).toBe('unsupported');
  });

  it('requests permission through the API boundary', async () => {
    const api = createApi('default');

    await expect(requestBrowserNotificationPermission(api)).resolves.toBe('granted');

    expect(api.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('sends a completion notification when enabled and granted', () => {
    const api = createApi('granted');
    const dispatcher = createBrowserNotificationDispatcher({
      api,
      getSettings: () => ({ enabled: true }),
    });

    const result = dispatcher.notify(buildChatCompletionNotification({
      eventId: 'assistant-1:complete',
      sessionName: 'Build',
      content: 'The test run passed and the work item is ready.',
    }));

    expect(result).toBe('sent');
    expect(api.showNotification).toHaveBeenCalledWith('Session work complete', {
      body: 'Build: The test run passed and the work item is ready.',
      tag: 'assistant-1:complete',
    });
  });

  it('skips notifications when disabled or denied', () => {
    const disabledApi = createApi('granted');
    const disabledDispatcher = createBrowserNotificationDispatcher({
      api: disabledApi,
      getSettings: () => ({ enabled: false }),
    });
    expect(disabledDispatcher.notify(buildChatCompletionNotification({
      eventId: 'assistant-1:complete',
      sessionName: 'Build',
      content: 'Done.',
    }))).toBe('disabled');
    expect(disabledApi.showNotification).not.toHaveBeenCalled();

    const deniedApi = createApi('denied');
    const deniedDispatcher = createBrowserNotificationDispatcher({
      api: deniedApi,
      getSettings: () => ({ enabled: true }),
    });
    expect(deniedDispatcher.notify(buildChatCompletionNotification({
      eventId: 'assistant-2:complete',
      sessionName: 'Build',
      content: 'Done.',
    }))).toBe('permission-denied');
    expect(deniedApi.showNotification).not.toHaveBeenCalled();
  });

  it('dedupes repeated notification event ids', () => {
    const api = createApi('granted');
    const dispatcher = createBrowserNotificationDispatcher({
      api,
      getSettings: () => ({ enabled: true }),
    });
    const event = buildChatCompletionNotification({
      eventId: 'assistant-1:complete',
      sessionName: 'Build',
      content: 'Done.',
    });

    expect(dispatcher.notify(event)).toBe('sent');
    expect(dispatcher.notify(event)).toBe('duplicate');
    expect(api.showNotification).toHaveBeenCalledTimes(1);
  });

  it('detects elicitation text and formats user-input notifications', () => {
    expect(isLikelyUserElicitation('Please choose option A or B before I continue.')).toBe(true);
    expect(isLikelyUserElicitation('Can I apply these changes?')).toBe(true);
    expect(isLikelyUserElicitation('The background task completed successfully.')).toBe(false);

    expect(buildChatElicitationNotification({
      eventId: 'assistant-3:elicitation',
      sessionName: 'Research',
      content: 'Please approve running the network check.',
    })).toEqual({
      id: 'assistant-3:elicitation',
      title: 'Agent needs input',
      body: 'Research: Please approve running the network check.',
    });
  });
});
