// ============================================================
// Public interface types
// ============================================================

export type CreateInAppPageOptions = {
  /** Attribute used by getByTestId. Default: 'data-testid' */
  testIdAttribute?: string;
  /** Default timeout for all actions/queries (ms). Default: 5000 */
  defaultTimeoutMs?: number;
  /** Animation frames to wait during stability check. Default: 2 */
  stableFrames?: number;
  /** Quiet DOM period (ms) before acting. Default: 75 */
  quietDomMs?: number;
  /** Traverse open shadow roots. Default: true */
  enableShadowDomTraversal?: boolean;
  logger?: AgentLogger;
  activationBroker?: UserActivationBroker;
  registry?: AgentRegistryInterface;
  frameChannels?: FrameChannelRegistry;
};

export type RoleOptions = {
  name?: string | RegExp;
  exact?: boolean;
  includeHidden?: boolean;
};

export type TextOptions = {
  exact?: boolean;
};

export type ClickOptions = {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  force?: boolean;
  timeout?: number;
  trial?: boolean;
  position?: { x: number; y: number };
};

export type FillOptions = {
  force?: boolean;
  timeout?: number;
};

export type PressOptions = {
  timeout?: number;
  delay?: number;
};

export type PressSequentiallyOptions = {
  delay?: number;
  timeout?: number;
};

export type HoverOptions = {
  force?: boolean;
  timeout?: number;
};

export type ActionOptions = {
  force?: boolean;
  timeout?: number;
};

export type TimeoutOnly = {
  timeout?: number;
};

export type SelectOptionArg =
  | string
  | string[]
  | { value?: string; label?: string }[];

export type WaitForOptions = {
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
};

// ============================================================
// Logger
// ============================================================

export type AgentLogger = {
  debug?(event: string, data?: unknown): void;
  info?(event: string, data?: unknown): void;
  warn?(event: string, data?: unknown): void;
  error?(event: string, data?: unknown): void;
};

// ============================================================
// Activation broker
// ============================================================

export interface UserActivationBroker {
  isActive(): boolean;
  requireActivation(): void;
}

// ============================================================
// Agent registry
// ============================================================

export type AgentNodeState = {
  visible?: boolean;
  enabled?: boolean;
  value?: string;
  checked?: boolean;
};

export type AgentNode = {
  id: string;
  element?: HTMLElement;
  role?: string;
  getState?: () => AgentNodeState;
  actions?: Record<string, (...args: unknown[]) => unknown | Promise<unknown>>;
};

export interface AgentRegistryInterface {
  register(node: AgentNode): () => void;
  get(id: string): AgentNode | undefined;
  has(id: string): boolean;
  list(): AgentNode[];
}

// ============================================================
// Frame channels
// ============================================================

export interface CrossOriginFrameChannel {
  targetOrigin: string;
  send<TReq, TRes>(request: TReq): Promise<TRes>;
}

export interface FrameChannelRegistry {
  getForIframe(iframe: HTMLIFrameElement): CrossOriginFrameChannel | undefined;
}

// ============================================================
// Internal query plan types
// ============================================================

export type QueryRoot =
  | { kind: 'document'; document: Document }
  | { kind: 'element'; element: HTMLElement }
  | { kind: 'same-origin-frame'; iframe: HTMLIFrameElement; document: Document }
  | { kind: 'remote-frame'; channel: CrossOriginFrameChannel };

/** A root getter function — allows lazy resolution for frame locators */
export type RootGetter = () => Promise<QueryRoot>;

export type QueryStep =
  | { kind: 'css'; selector: string }
  | { kind: 'role'; role: string; options?: RoleOptions }
  | { kind: 'text'; text: string | RegExp; options?: TextOptions }
  | { kind: 'label'; text: string | RegExp; options?: TextOptions }
  | { kind: 'placeholder'; text: string | RegExp; options?: TextOptions }
  | { kind: 'testid'; id: string | RegExp }
  | { kind: 'filter'; hasText?: string | RegExp; has?: QueryStep[] }
  | { kind: 'nth'; index: number }
  | { kind: 'first' }
  | { kind: 'last' };

export type ResolvedNode = {
  element: HTMLElement;
  scopeDocument: Document;
  framePath: string[];
};

// ============================================================
// RPC protocol types
// ============================================================

export type SerializedLocatorPlan = {
  steps: QueryStep[];
};

export type SerializedAction = {
  type:
    | 'click'
    | 'fill'
    | 'press'
    | 'pressSequentially'
    | 'focus'
    | 'blur'
    | 'check'
    | 'uncheck'
    | 'selectOption'
    | 'hover'
    | 'scrollIntoViewIfNeeded';
  options?: unknown;
};

export type SerializedQuery = {
  type: 'textContent' | 'inputValue' | 'isVisible' | 'isEnabled' | 'count' | 'waitFor';
  options?: unknown;
};

export type FrameRPCRequest = {
  rpc: 'in-app-playwright';
  id: string;
  kind: 'locator-action' | 'locator-query';
  plan: SerializedLocatorPlan;
  action?: SerializedAction;
  query?: SerializedQuery;
};

export type FrameRPCResponse = {
  rpc: 'in-app-playwright';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// ============================================================
// Public locator / page interfaces
// ============================================================

export interface PlaywrightLikeLocator {
  locator(selector: string): PlaywrightLikeLocator;
  getByRole(role: string, options?: RoleOptions): PlaywrightLikeLocator;
  getByText(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByLabel(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByPlaceholder(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByTestId(id: string | RegExp): PlaywrightLikeLocator;
  frameLocator(selector: string): PlaywrightLikeFrameLocator;
  filter(options: {
    hasText?: string | RegExp;
    has?: PlaywrightLikeLocator;
  }): PlaywrightLikeLocator;
  nth(index: number): PlaywrightLikeLocator;
  first(): PlaywrightLikeLocator;
  last(): PlaywrightLikeLocator;

  click(options?: ClickOptions): Promise<void>;
  fill(value: string, options?: FillOptions): Promise<void>;
  press(key: string, options?: PressOptions): Promise<void>;
  pressSequentially(text: string, options?: PressSequentiallyOptions): Promise<void>;
  focus(options?: TimeoutOnly): Promise<void>;
  blur(options?: TimeoutOnly): Promise<void>;
  hover(options?: HoverOptions): Promise<void>;
  check(options?: ActionOptions): Promise<void>;
  uncheck(options?: ActionOptions): Promise<void>;
  selectOption(value: SelectOptionArg): Promise<void>;
  scrollIntoViewIfNeeded(options?: TimeoutOnly): Promise<void>;

  textContent(options?: TimeoutOnly): Promise<string | null>;
  inputValue(options?: TimeoutOnly): Promise<string>;
  getAttribute(name: string, options?: TimeoutOnly): Promise<string | null>;
  isVisible(options?: TimeoutOnly): Promise<boolean>;
  isEnabled(options?: TimeoutOnly): Promise<boolean>;
  count(): Promise<number>;
  waitFor(options?: WaitForOptions): Promise<void>;
  evaluate<R, A = HTMLElement>(fn: (el: A) => R, arg?: unknown): Promise<R>;

  /** Returns a stable human-readable description for error messages. */
  describe(): string;
}

export interface PlaywrightLikeFrameLocator {
  locator(selector: string): PlaywrightLikeLocator;
  getByRole(role: string, options?: RoleOptions): PlaywrightLikeLocator;
  getByText(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByLabel(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByPlaceholder(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByTestId(id: string | RegExp): PlaywrightLikeLocator;
  frameLocator(selector: string): PlaywrightLikeFrameLocator;
}

export interface PlaywrightLikePage {
  locator(selector: string): PlaywrightLikeLocator;
  getByRole(role: string, options?: RoleOptions): PlaywrightLikeLocator;
  getByText(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByLabel(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByPlaceholder(text: string | RegExp, options?: TextOptions): PlaywrightLikeLocator;
  getByTestId(id: string | RegExp): PlaywrightLikeLocator;
  frameLocator(selector: string): PlaywrightLikeFrameLocator;

  evaluate<R, A = unknown>(fn: (arg: A) => R, arg?: A): Promise<R>;
  waitForFunction<R>(
    fn: () => R | Promise<R>,
    options?: { timeout?: number },
  ): Promise<R>;
  waitForTimeout(ms: number): Promise<void>;

  addLocatorHandler?(
    locator: PlaywrightLikeLocator,
    handler: () => Promise<void> | void,
  ): Promise<void>;
}
