import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  isArtifactContextBySession,
  isArtifactsByWorkspace,
  isChatMessagesBySession,
  isHarnessAppSpecRecord,
  isStringArrayRecord,
  isStringRecord,
  isTreeNode,
  isWorkspaceViewStateRecord,
  loadJson,
  removeStoredRecordEntry,
  saveJson,
  useStoredState,
} from './sessionState';
import { createDefaultHarnessAppSpec } from '../features/harness-ui/harnessSpec';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('STORAGE_KEYS', () => {
  it('namespaces every key under agent-browser.', () => {
    for (const value of Object.values(STORAGE_KEYS)) {
      expect(value.startsWith('agent-browser.')).toBe(true);
    }
  });

  it('lists the categories that should survive a page refresh', () => {
    expect(STORAGE_KEYS).toMatchObject({
      installedModels: expect.any(String),
      selectedProviderBySession: expect.any(String),
      selectedCodiModelBySession: expect.any(String),
      selectedCopilotModelBySession: expect.any(String),
      selectedCursorModelBySession: expect.any(String),
      selectedCodexModelBySession: expect.any(String),
      activeWorkspaceId: expect.any(String),
      activePanel: expect.any(String),
      workspaceRoot: expect.any(String),
      workspaceViewStateByWorkspace: expect.any(String),
      chatMessagesBySession: expect.any(String),
      chatHistoryBySession: expect.any(String),
      artifactsByWorkspace: expect.any(String),
      artifactContextBySession: expect.any(String),
      browserNotificationSettings: expect.any(String),
      benchmarkModelRoutingSettings: expect.any(String),
      benchmarkEvidenceState: expect.any(String),
      adversaryToolReviewSettings: expect.any(String),
      securityReviewAgentSettings: expect.any(String),
      scheduledAutomationsState: expect.any(String),
      workspaceSkillPolicyState: expect.any(String),
      conversationBranchingState: expect.any(String),
      runtimePluginSettings: expect.any(String),
      browserAgentRunSdkState: expect.any(String),
      multitaskSubagentState: expect.any(String),
      harnessSpecsByWorkspace: expect.any(String),
      installedDefaultExtensionIds: expect.any(String),
      defaultExtensionOpenFeatureFlags: expect.any(String),
      defaultExtensionConfigurationById: expect.any(String),
    });
    expect(STORAGE_KEYS.securityReviewAgentSettings).toBe('agent-browser.security-review-agent-settings');
    expect(STORAGE_KEYS.scheduledAutomationsState).toBe('agent-browser.scheduled-automations-state');
    expect(STORAGE_KEYS.workspaceSkillPolicyState).toBe('agent-browser.workspace-skill-policy-state');
    expect(STORAGE_KEYS.conversationBranchingState).toBe('agent-browser.conversation-branching-state');
    expect(STORAGE_KEYS.browserAgentRunSdkState).toBe('agent-browser.browser-agent-run-sdk-state');
    expect(STORAGE_KEYS.multitaskSubagentState).toBe('agent-browser.multitask-subagent-state');
    expect(STORAGE_KEYS.runtimePluginSettings).toBe('agent-browser.runtime-plugin-settings');
  });
});

describe('persistent session validators', () => {
  it('accepts valid workspace trees and rejects invalid tree nodes', () => {
    expect(isTreeNode(null)).toBe(false);
    expect(isTreeNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      expanded: true,
      children: [{ id: 'session-1', name: 'Session 1', type: 'tab', nodeKind: 'session' }],
    })).toBe(true);

    expect(isTreeNode({ id: 'root', name: 'Root', type: 'invalid' })).toBe(false);
    expect(isTreeNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      nodeKind: 'bogus',
    })).toBe(false);
    expect(isTreeNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      nodeKind: 1,
    })).toBe(false);
    expect(isTreeNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      memoryMB: 'large',
    })).toBe(false);
    expect(isTreeNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      children: [{ id: 'child', name: 'Child', type: 'bogus' }],
    })).toBe(false);
    expect(isTreeNode({
      id: 'artifact:file',
      name: 'index.html',
      type: 'file',
      artifactId: 'artifact-1',
      artifactFilePath: 'index.html',
    })).toBe(true);
    expect(isTreeNode({
      id: 'artifact:file',
      name: 'index.html',
      type: 'file',
      artifactId: 1,
    })).toBe(false);
  });

  it('accepts valid workspace view state records and rejects bad active modes', () => {
    expect(isWorkspaceViewStateRecord({
      'ws-research': {
        openTabIds: [],
        editingFilePath: 'notes.md',
        dashboardOpen: true,
        activeMode: 'agent',
        activeSessionIds: ['session-1'],
        mountedSessionFsIds: ['session-1'],
        panelOrder: ['session:session-1'],
      },
    })).toBe(true);

    expect(isWorkspaceViewStateRecord({
      'ws-legacy': {
        openTabIds: [],
        editingFilePath: null,
        activeMode: 'terminal',
        activeSessionIds: [],
        mountedSessionFsIds: [],
        panelOrder: [],
      },
    })).toBe(true);

    expect(isWorkspaceViewStateRecord({
      'ws-research': {
        openTabIds: [],
        editingFilePath: null,
        activeMode: 'browser',
        activeSessionIds: [],
        mountedSessionFsIds: [],
        panelOrder: [],
      },
    })).toBe(false);
    expect(isWorkspaceViewStateRecord({ 'ws-research': null })).toBe(false);
  });

  it('accepts persisted chat transcripts and chat history records', () => {
    expect(isChatMessagesBySession({
      'session-1': [
        { id: 'session-1:system', role: 'system', content: 'Ready' },
        { id: 'message-1', role: 'user', content: 'Hello' },
      ],
    })).toBe(true);

    expect(isChatMessagesBySession({
      'session-1': [{ id: 'bad', role: 'bogus', content: 'Nope' }],
    })).toBe(false);
    expect(isStringArrayRecord({ 'session-1': ['Hello', 'Again'] })).toBe(true);
    expect(isStringArrayRecord({ 'session-1': ['Hello', 42] })).toBe(false);
  });

  it('accepts persisted harness app specs and rejects unsafe generated specs', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    expect(isHarnessAppSpecRecord({ 'ws-research': spec })).toBe(true);
    expect(isHarnessAppSpecRecord({
      'ws-research': {
        ...spec,
        metadata: { ...spec.metadata, designSystemId: 'other-design' },
      },
    })).toBe(false);
    expect(isHarnessAppSpecRecord({
      'ws-research': {
        ...spec,
        elements: {
          ...spec.elements,
          'bad-widget': { id: 'bad-widget', type: 'RawHtml', props: { className: 'x' } },
        },
      },
    })).toBe(false);
  });

  it('rejects invalid record and optional persisted chat fields', () => {
    expect(isStringRecord(null)).toBe(false);
    expect(isStringRecord({ valid: 'yes', invalid: 1 })).toBe(false);
    expect(isStringRecord({ valid: 'yes' })).toBe(true);
    expect(isStringArrayRecord(null)).toBe(false);
    expect(isWorkspaceViewStateRecord(null)).toBe(false);
    expect(isChatMessagesBySession(null)).toBe(false);
    expect(isChatMessagesBySession({ 'session-1': [null] })).toBe(false);
    expect(isChatMessagesBySession({
      'session-1': [{ id: 'bad-status', role: 'assistant', content: '', status: 'paused' }],
    })).toBe(false);
    expect(isChatMessagesBySession({
      'session-1': [{ id: 'bad-stream', role: 'assistant', content: '', streamedContent: 1 }],
    })).toBe(false);
    expect(isChatMessagesBySession({
      'session-1': [{
        id: 'ok-status',
        role: 'assistant',
        content: '',
        status: 'complete',
        loadingStatus: 'complete',
        statusText: null,
      }],
    })).toBe(true);
    expect(isChatMessagesBySession({
      'session-1': [{
        id: 'ok-status-text',
        role: 'assistant',
        content: '',
        loadingStatus: null,
        statusText: 'stopped',
      }],
    })).toBe(true);
  });

  it('accepts persisted artifact libraries and session attachment records', () => {
    expect(isArtifactsByWorkspace({
      'ws-build': [{
        id: 'artifact-dashboard',
        title: 'Launch dashboard',
        kind: 'html',
        createdAt: '2026-05-03T12:00:00.000Z',
        updatedAt: '2026-05-03T12:00:00.000Z',
        references: ['artifact-styleguide'],
        files: [
          { path: 'index.html', mediaType: 'text/html', content: '<main>Launch</main>' },
        ],
        versions: [],
      }],
    })).toBe(true);
    expect(isArtifactsByWorkspace({
      'ws-build': [{
        id: 'artifact-dashboard',
        title: 'Launch dashboard',
        createdAt: '2026-05-03T12:00:00.000Z',
        updatedAt: '2026-05-03T12:00:00.000Z',
        files: [{ path: '../index.html', content: '<main>Launch</main>' }],
      }],
    })).toBe(false);
    expect(isArtifactsByWorkspace({
      'ws-build': [{
        id: 'artifact-dashboard',
        title: 'Launch dashboard',
        createdAt: '2026-05-03T12:00:00.000Z',
        updatedAt: '2026-05-03T12:00:00.000Z',
        references: [],
        files: [{ path: 'index.html', content: '<main>Launch</main>' }],
      }],
    })).toBe(false);
    expect(isArtifactContextBySession({ 'session-1': ['artifact-dashboard'] })).toBe(true);
    expect(isArtifactContextBySession({ 'session-1': [42] })).toBe(false);
  });
});

describe('loadJson', () => {
  it('returns the fallback when the key is missing', () => {
    expect(loadJson(window.localStorage, 'missing', isStringArray, ['default'])).toEqual(['default']);
  });

  it('returns the fallback when storage read throws', () => {
    const failing = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage;

    expect(loadJson(failing, 'missing', isStringArray, ['default'])).toEqual(['default']);
  });

  it('returns the fallback when the stored payload is not valid JSON', () => {
    window.localStorage.setItem('broken', '{not-json');
    expect(loadJson(window.localStorage, 'broken', isStringArray, ['fallback'])).toEqual(['fallback']);
  });

  it('returns the fallback when the validator rejects the parsed payload', () => {
    window.localStorage.setItem('shape', JSON.stringify({ unexpected: true }));
    expect(loadJson(window.localStorage, 'shape', isStringArray, [])).toEqual([]);
  });

  it('returns the parsed value when the validator accepts it', () => {
    window.localStorage.setItem('ok', JSON.stringify(['a', 'b']));
    expect(loadJson(window.localStorage, 'ok', isStringArray, [])).toEqual(['a', 'b']);
  });
});

describe('saveJson', () => {
  it('writes JSON to the backend', () => {
    saveJson(window.sessionStorage, 'k', { a: 1 });
    expect(window.sessionStorage.getItem('k')).toBe(JSON.stringify({ a: 1 }));
  });

  it('invokes onError when setItem throws (e.g. quota exceeded)', () => {
    const onError = vi.fn();
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    saveJson(failing, 'k', [1], onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('wraps non-Error storage failures before invoking onError', () => {
    const onError = vi.fn();
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw 'quota exceeded';
      },
      removeItem: () => undefined,
    } as unknown as Storage;

    saveJson(failing, 'k', [1], onError);

    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('quota exceeded');
  });
});

describe('removeStoredRecordEntry', () => {
  it('ignores missing storage backends', () => {
    expect(() => removeStoredRecordEntry(null, 'record', isStringArrayRecord, 'remove')).not.toThrow();
  });

  it('removes one entry from a valid stored record', () => {
    window.localStorage.setItem('record', JSON.stringify({ keep: ['a'], remove: ['b'] }));

    removeStoredRecordEntry(window.localStorage, 'record', isStringArrayRecord, 'remove');

    expect(JSON.parse(window.localStorage.getItem('record') ?? '{}')).toEqual({ keep: ['a'] });
  });

  it('does not rewrite storage when the entry is absent', () => {
    window.localStorage.setItem('record', JSON.stringify({ keep: ['a'] }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    removeStoredRecordEntry(window.localStorage, 'record', isStringArrayRecord, 'missing');

    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('useStoredState', () => {
  it('hydrates from storage on mount when a value is present', () => {
    window.localStorage.setItem('hydrated', JSON.stringify(['installed-1']));
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'hydrated', isStringArray, [] as string[]),
    );
    expect(result.current[0]).toEqual(['installed-1']);
  });

  it('uses the fallback when storage is empty', () => {
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'fresh', isStringArray, ['default']),
    );
    expect(result.current[0]).toEqual(['default']);
  });

  it('persists the next value to storage when set', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'writes', isStringArray, [] as string[]),
    );

    act(() => {
      result.current[1](['next']);
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(JSON.parse(window.localStorage.getItem('writes') ?? 'null')).toEqual(['next']);
  });

  it('falls back to the default when the stored value fails validation', () => {
    window.localStorage.setItem('bad', JSON.stringify({ unexpected: true }));
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'bad', isStringArray, ['default']),
    );
    expect(result.current[0]).toEqual(['default']);
  });

  it('uses the fallback and skips persistence when no backend is available', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStoredState(null, 'missing-backend', isStringArray, ['default']),
    );

    act(() => {
      result.current[1](['next']);
      vi.runAllTimers();
    });

    expect(result.current[0]).toEqual(['next']);
    expect(window.localStorage.getItem('missing-backend')).toBeNull();
  });

  it('clears pending persistence timers on unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useStoredState(window.localStorage, 'cleanup', isStringArray, [] as string[], { debounceMs: 1000 }),
    );

    act(() => {
      result.current[1](['next']);
    });
    unmount();
    act(() => {
      vi.runAllTimers();
    });

    expect(window.localStorage.getItem('cleanup')).toBeNull();
  });
});
