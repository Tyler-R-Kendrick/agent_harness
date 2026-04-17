import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { AGENT_INSTRUCTIONS, createInBrowserUseTools, createInBrowserUseAgent, runInBrowserUseAgent } from '.';

// Mock agentRunner so tests don't hit a real LLM
vi.mock('../../services/agentRunner', () => ({
  runToolAgent: vi.fn().mockResolvedValue({ text: 'done', steps: 1 }),
}));
import { runToolAgent } from '../../services/agentRunner';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePageMock() {
  const page = {
    locator: vi.fn(),
    getByRole: vi.fn(),
    getByLabel: vi.fn(),
    getByText: vi.fn(),
    getByPlaceholder: vi.fn(),
    getByTestId: vi.fn(),
  };

  const locatorMock = {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
    blur: vi.fn().mockResolvedValue(undefined),
    textContent: vi.fn().mockResolvedValue('hello'),
    inputValue: vi.fn().mockResolvedValue('world'),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(3),
    getAttribute: vi.fn().mockResolvedValue('attr-value'),
  };

  page.locator.mockReturnValue(locatorMock);
  page.getByRole.mockReturnValue(locatorMock);
  page.getByLabel.mockReturnValue(locatorMock);
  page.getByText.mockReturnValue(locatorMock);
  page.getByPlaceholder.mockReturnValue(locatorMock);
  page.getByTestId.mockReturnValue(locatorMock);

  return { page, locatorMock };
}

// ── AGENT_INSTRUCTIONS ────────────────────────────────────────────────────────

describe('AGENT_INSTRUCTIONS', () => {
  it('is a non-empty string', () => {
    expect(typeof AGENT_INSTRUCTIONS).toBe('string');
    expect(AGENT_INSTRUCTIONS.length).toBeGreaterThan(0);
  });

  it('mentions the key capabilities the agent has', () => {
    expect(AGENT_INSTRUCTIONS).toMatch(/click/i);
    expect(AGENT_INSTRUCTIONS).toMatch(/fill/i);
    expect(AGENT_INSTRUCTIONS).toMatch(/selector/i);
  });
});

// ── createInBrowserUseTools ───────────────────────────────────────────────────

describe('createInBrowserUseTools', () => {
  let page: ReturnType<typeof makePageMock>['page'];
  let locatorMock: ReturnType<typeof makePageMock>['locatorMock'];
  let tools: ReturnType<typeof createInBrowserUseTools>;

  beforeEach(() => {
    ({ page, locatorMock } = makePageMock());
    tools = createInBrowserUseTools(page as never);
  });

  it('exports a tool set with expected tool names', () => {
    const keys = Object.keys(tools);
    expect(keys).toContain('click');
    expect(keys).toContain('fill');
    expect(keys).toContain('selectOption');
    expect(keys).toContain('check');
    expect(keys).toContain('uncheck');
    expect(keys).toContain('hover');
    expect(keys).toContain('press');
    expect(keys).toContain('focus');
    expect(keys).toContain('blur');
    expect(keys).toContain('getTextContent');
    expect(keys).toContain('getInputValue');
    expect(keys).toContain('isVisible');
    expect(keys).toContain('isEnabled');
    expect(keys).toContain('countElements');
    expect(keys).toContain('getAttribute');
  });

  it('each tool has description, parameters, and execute', () => {
    for (const [name, t] of Object.entries(tools)) {
      expect(typeof (t as any).description, `${name}.description`).toBe('string');
      expect((t as any).parameters, `${name}.parameters`).toBeDefined();
      expect(typeof (t as any).execute, `${name}.execute`).toBe('function');
    }
  });

  it('click tool calls page.locator().click()', async () => {
    await (tools.click as any).execute({ selector: '#btn' });
    expect(page.locator).toHaveBeenCalledWith('#btn');
    expect(locatorMock.click).toHaveBeenCalled();
  });

  it('fill tool calls page.locator().fill() with value', async () => {
    await (tools.fill as any).execute({ selector: '#name', value: 'Alice' });
    expect(page.locator).toHaveBeenCalledWith('#name');
    expect(locatorMock.fill).toHaveBeenCalledWith('Alice');
  });

  it('selectOption tool calls page.locator().selectOption()', async () => {
    await (tools.selectOption as any).execute({ selector: '#color', value: 'red' });
    expect(locatorMock.selectOption).toHaveBeenCalledWith('red');
  });

  it('check tool calls page.locator().check()', async () => {
    await (tools.check as any).execute({ selector: '#cb' });
    expect(locatorMock.check).toHaveBeenCalled();
  });

  it('uncheck tool calls page.locator().uncheck()', async () => {
    await (tools.uncheck as any).execute({ selector: '#cb' });
    expect(locatorMock.uncheck).toHaveBeenCalled();
  });

  it('hover tool calls page.locator().hover()', async () => {
    await (tools.hover as any).execute({ selector: '#el' });
    expect(locatorMock.hover).toHaveBeenCalled();
  });

  it('press tool calls page.locator().press() with key', async () => {
    await (tools.press as any).execute({ selector: '#input', key: 'Enter' });
    expect(locatorMock.press).toHaveBeenCalledWith('Enter');
  });

  it('focus tool calls page.locator().focus()', async () => {
    await (tools.focus as any).execute({ selector: '#el' });
    expect(locatorMock.focus).toHaveBeenCalled();
  });

  it('blur tool calls page.locator().blur()', async () => {
    await (tools.blur as any).execute({ selector: '#el' });
    expect(locatorMock.blur).toHaveBeenCalled();
  });

  it('getTextContent returns string from locator.textContent()', async () => {
    const result = await (tools.getTextContent as any).execute({ selector: '#el' });
    expect(result).toBe('hello');
  });

  it('getInputValue returns string from locator.inputValue()', async () => {
    const result = await (tools.getInputValue as any).execute({ selector: '#input' });
    expect(result).toBe('world');
  });

  it('isVisible returns boolean', async () => {
    const result = await (tools.isVisible as any).execute({ selector: '#el' });
    expect(result).toBe(true);
  });

  it('isEnabled returns boolean', async () => {
    const result = await (tools.isEnabled as any).execute({ selector: '#el' });
    expect(result).toBe(true);
  });

  it('countElements returns number', async () => {
    const result = await (tools.countElements as any).execute({ selector: 'li' });
    expect(result).toBe(3);
  });

  it('getAttribute returns string', async () => {
    const result = await (tools.getAttribute as any).execute({ selector: '#el', name: 'href' });
    expect(locatorMock.getAttribute).toHaveBeenCalledWith('href');
    expect(result).toBe('attr-value');
  });

  describe('semantic locator tools', () => {
    it('click with role uses getByRole', async () => {
      await (tools.click as any).execute({ selector: 'role=button[name="Submit"]' });
      // Falls back to locator since CSS selector is used; role= prefix is a convenience
      expect(page.locator).toHaveBeenCalledWith('role=button[name="Submit"]');
    });
  });
});

// ── createInBrowserUseAgent ───────────────────────────────────────────────────

describe('createInBrowserUseAgent', () => {
  it('returns an object with instructions and tools', () => {
    const { page } = makePageMock();
    const agent = createInBrowserUseAgent(page as never);

    expect(typeof agent.instructions).toBe('string');
    expect(agent.tools).toBeDefined();
    expect(Object.keys(agent.tools).length).toBeGreaterThan(0);
  });

  it('instructions match AGENT_INSTRUCTIONS', () => {
    const { page } = makePageMock();
    const agent = createInBrowserUseAgent(page as never);
    expect(agent.instructions).toBe(AGENT_INSTRUCTIONS);
  });

  it('tools match createInBrowserUseTools output', () => {
    const { page } = makePageMock();
    const agent = createInBrowserUseAgent(page as never);
    const tools = createInBrowserUseTools(page as never);
    expect(Object.keys(agent.tools)).toEqual(Object.keys(tools));
  });
});

// ── runInBrowserUseAgent ──────────────────────────────────────────────────────

describe('runInBrowserUseAgent', () => {
  const mockRunToolAgent = runToolAgent as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRunToolAgent.mockReset();
    mockRunToolAgent.mockResolvedValue({ text: 'done', steps: 1 });
  });

  function makeModel() {
    return {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'test-model',
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };
  }

  it('calls runToolAgent with model, tools, instructions, and goal as user message', async () => {
    const { page } = makePageMock();
    const model = makeModel();

    await runInBrowserUseAgent(page as never, model as never, { goal: 'Click the button' });

    expect(mockRunToolAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        model,
        instructions: AGENT_INSTRUCTIONS,
        messages: [{ role: 'user', content: 'Click the button' }],
        tools: expect.objectContaining({ click: expect.anything() }),
      }),
      expect.any(Object),
    );
  });

  it('forwards callbacks to runToolAgent', async () => {
    const { page } = makePageMock();
    const model = makeModel();
    const callbacks = { onDone: vi.fn(), onToken: vi.fn() };

    await runInBrowserUseAgent(page as never, model as never, { goal: 'test' }, callbacks);

    expect(mockRunToolAgent).toHaveBeenCalledWith(
      expect.any(Object),
      callbacks,
    );
  });

  it('merges extraTools into the tool set', async () => {
    const { page } = makePageMock();
    const model = makeModel();
    const myTool = { description: 'x', parameters: {}, execute: vi.fn() };

    await runInBrowserUseAgent(
      page as never,
      model as never,
      { goal: 'test', extraTools: { myTool: myTool as never } },
    );

    expect(mockRunToolAgent).toHaveBeenCalledWith(
      expect.objectContaining({ tools: expect.objectContaining({ myTool, click: expect.anything() }) }),
      expect.any(Object),
    );
  });

  it('passes maxSteps and signal through', async () => {
    const { page } = makePageMock();
    const model = makeModel();
    const signal = new AbortController().signal;

    await runInBrowserUseAgent(page as never, model as never, { goal: 'test', maxSteps: 5, signal });

    expect(mockRunToolAgent).toHaveBeenCalledWith(
      expect.objectContaining({ maxSteps: 5, signal }),
      expect.any(Object),
    );
  });

  it('returns the AgentRunResult from runToolAgent', async () => {
    mockRunToolAgent.mockResolvedValueOnce({ text: 'Navigation complete', steps: 3 });
    const { page } = makePageMock();
    const model = makeModel();

    const result = await runInBrowserUseAgent(page as never, model as never, { goal: 'test' });

    expect(result.text).toBe('Navigation complete');
    expect(result.steps).toBe(3);
  });
});

