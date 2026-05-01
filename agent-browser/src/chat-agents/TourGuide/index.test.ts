import { describe, expect, it, vi } from 'vitest';
import {
  TOUR_GUIDE_AGENT_ID,
  buildTourGuideAgentPrompt,
  evaluateTourGuideAgentPolicy,
  isTourGuideTaskText,
  streamTourGuideChat,
} from '.';
import { DEFAULT_TOUR_TARGETS } from '../../features/tours/driverTour';

describe('TourGuide chat-agent', () => {
  it('detects product-tour help requests without capturing generic questions', () => {
    expect(isTourGuideTaskText('Show me how to configure tools.')).toBe(true);
    expect(isTourGuideTaskText('Can you walk me through the chat panel?')).toBe(true);
    expect(isTourGuideTaskText('Where is the agent provider selector?')).toBe(true);
    expect(isTourGuideTaskText('How do I fix a failing test?')).toBe(false);
  });

  it('builds a driver.js tour prompt that passes the AgentEvals policy rubric', () => {
    const prompt = buildTourGuideAgentPrompt({
      task: 'Show me how to use tools',
      targets: DEFAULT_TOUR_TARGETS,
      workspaceName: 'Build',
    });
    const policy = evaluateTourGuideAgentPolicy({ prompt });

    expect(TOUR_GUIDE_AGENT_ID).toBe('tour-guide');
    expect(prompt).toContain('driver.js');
    expect(prompt).toContain('known target registry');
    expect(prompt).toContain('button[aria-label^="Configure tools"]');
    expect(prompt).toContain('AgentBus');
    expect(policy).toEqual({
      passed: true,
      score: 1,
      checks: {
        referencesDriverJs: true,
        usesKnownTargetRegistry: true,
        emitsStructuredTourPlan: true,
        includesAgentBusTelemetry: true,
        rejectsUnsafeSelectors: true,
      },
    });
  });

  it('uses the active workspace label when no workspace name is supplied', () => {
    expect(buildTourGuideAgentPrompt({
      task: 'Show the workspace switcher',
      targets: DEFAULT_TOUR_TARGETS,
    })).toContain('Workspace: active workspace');
  });

  it('emits a guided tour plan and mirrors its lifecycle through AgentBus', async () => {
    const onTourPlan = vi.fn();
    const onBusEntry = vi.fn();
    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamTourGuideChat({
      messages: [{ id: 'user-1', role: 'user', content: 'Show me how to configure tools.' }],
      latestUserInput: 'Show me how to configure tools.',
      workspaceName: 'Build',
      workspacePromptContext: 'Use the active workspace.',
    }, { onTourPlan, onBusEntry, onToken, onDone });

    expect(onTourPlan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tools',
      steps: expect.arrayContaining([
        expect.objectContaining({ targetId: 'tools-picker' }),
      ]),
    }));
    expect(onToken).toHaveBeenCalledWith(expect.stringContaining('Started a guided tour'));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('Started a guided tour'));
    expect(onBusEntry.mock.calls.map(([entry]) => entry.payloadType)).toEqual(expect.arrayContaining([
      'Mail',
      'Policy',
      'Intent',
      'Commit',
      'Result',
      'Completion',
    ]));
    expect(onBusEntry.mock.calls.some(([entry]) => String(entry.detail).includes('driver.js'))).toBe(true);
  });

  it('falls back to streamed message content when latest input is blank', async () => {
    const onTourPlan = vi.fn();

    await streamTourGuideChat({
      messages: [{
        id: 'assistant-draft',
        role: 'assistant',
        content: '',
        streamedContent: 'Show me how to switch terminal mode.',
      }],
      latestUserInput: '',
      workspaceName: 'Agent Browser',
      workspacePromptContext: 'Use the active workspace.',
    }, { onTourPlan });

    expect(onTourPlan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'modes',
      steps: expect.arrayContaining([
        expect.objectContaining({ targetId: 'terminal-mode' }),
      ]),
    }));
  });

  it('falls back to message content when no streamed content is available', async () => {
    const onTourPlan = vi.fn();

    await streamTourGuideChat({
      messages: [{
        id: 'user-fallback',
        role: 'user',
        content: 'Where is the agent provider selector?',
      }],
      latestUserInput: '',
      workspaceName: 'Agent Browser',
      workspacePromptContext: 'Use the active workspace.',
    }, { onTourPlan });

    expect(onTourPlan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'agent-provider',
    }));
  });

  it('uses the default getting-started tour when no input text exists', async () => {
    const onTourPlan = vi.fn();

    await streamTourGuideChat({
      messages: [],
      latestUserInput: '',
      workspaceName: 'Agent Browser',
      workspacePromptContext: 'Use the active workspace.',
    }, { onTourPlan });

    expect(onTourPlan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'getting-started',
    }));
  });
});
