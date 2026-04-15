export const SANDBOX_PROTOCOL_VERSION = '1.0.0';
export const SANDBOX_CONTROL_RUN_ID = '__session__';
export const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024;

export const DEFAULT_RUN_LIMITS = {
  maxRuntimeMs: 15_000,
  maxStdoutBytes: 32_768,
  maxStderrBytes: 32_768,
  maxLogBytes: 32_768,
  maxEventCount: 256,
  maxArtifactBytes: 65_536,
  maxWorkspaceBytes: 262_144,
} as const;

export type NetworkPolicy = 'deny' | 'restricted';
export type RunTerminalStatus = 'succeeded' | 'failed' | 'timed_out' | 'aborted' | 'limit_exceeded';
export type TestStatus = 'passed' | 'failed' | 'skipped';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ArtifactEncoding = 'utf-8' | 'base64';
export type ArtifactPersistenceMode = 'none' | 'just-bash';
export type SandboxMessageType =
  | 'runner_ready'
  | 'run_request'
  | 'run_ack'
  | 'run_log'
  | 'run_stdout'
  | 'run_stderr'
  | 'run_test_result'
  | 'run_metrics'
  | 'run_error'
  | 'run_done'
  | 'run_abort';

export interface RunLimits {
  maxRuntimeMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  maxLogBytes: number;
  maxEventCount: number;
  maxArtifactBytes: number;
  maxWorkspaceBytes: number;
}

export interface RunWorkspaceFile {
  path: string;
  content: string;
}

export interface RunCommand {
  command: string;
  args?: string[];
  cwd?: string;
}

export interface ExecutionArtifact {
  path: string;
  content: string;
  encoding?: ArtifactEncoding;
}

export interface ArtifactPersistenceRequest {
  mode: ArtifactPersistenceMode;
  rootDir?: string;
}

export interface RunRequest {
  title?: string;
  files: RunWorkspaceFile[];
  command: RunCommand;
  timeoutMs?: number;
  networkPolicy?: NetworkPolicy;
  limits?: Partial<RunLimits>;
  metadata?: Record<string, string>;
  capturePaths?: string[];
  persist?: ArtifactPersistenceRequest;
}

export interface SandboxEnvelope<TType extends SandboxMessageType, TPayload> {
  protocolVersion: typeof SANDBOX_PROTOCOL_VERSION;
  sessionId: string;
  runId: string;
  timestamp: number;
  type: TType;
  payload: TPayload;
}

export type RunnerReadyMessage = SandboxEnvelope<'runner_ready', {
  adapter: 'mock' | 'webcontainer' | 'unavailable';
  supportsAbort: boolean;
  networkPolicy: NetworkPolicy;
}>;

export type RunRequestMessage = SandboxEnvelope<'run_request', { request: RunRequest }>;

export type RunAckMessage = SandboxEnvelope<'run_ack', { acceptedAt: number }>;

export type RunLogMessage = SandboxEnvelope<'run_log', {
  level: LogLevel;
  chunk: string;
  bytes: number;
}>;

export type RunStdoutMessage = SandboxEnvelope<'run_stdout', {
  chunk: string;
  bytes: number;
}>;

export type RunStderrMessage = SandboxEnvelope<'run_stderr', {
  chunk: string;
  bytes: number;
}>;

export type RunTestResultMessage = SandboxEnvelope<'run_test_result', {
  suite: string;
  name: string;
  status: TestStatus;
  durationMs?: number;
  details?: string;
}>;

export type RunMetricsMessage = SandboxEnvelope<'run_metrics', {
  wallClockMs: number;
  stdoutBytes: number;
  stderrBytes: number;
  logBytes: number;
  eventCount: number;
  artifactBytes: number;
}>;

export type RunErrorMessage = SandboxEnvelope<'run_error', {
  code: string;
  message: string;
  fatal: boolean;
  phase?: string;
  details?: string;
}>;

export type RunDoneMessage = SandboxEnvelope<'run_done', {
  exitCode: number;
  status: RunTerminalStatus;
  reason?: string;
  artifacts?: ExecutionArtifact[];
}>;

export type RunAbortMessage = SandboxEnvelope<'run_abort', {
  reason?: string;
}>;

export type HostToRunnerMessage = RunRequestMessage | RunAbortMessage;
export type RunnerToHostMessage =
  | RunnerReadyMessage
  | RunAckMessage
  | RunLogMessage
  | RunStdoutMessage
  | RunStderrMessage
  | RunTestResultMessage
  | RunMetricsMessage
  | RunErrorMessage
  | RunDoneMessage;

export type SandboxMessage = HostToRunnerMessage | RunnerToHostMessage;

export interface ProtocolValidationOptions {
  direction?: 'host-to-runner' | 'runner-to-host' | 'any';
  expectedSessionId?: string;
  expectedRunId?: string;
  maxBytes?: number;
}

export interface ProtocolValidationSuccess<TMessage extends SandboxMessage = SandboxMessage> {
  ok: true;
  bytes: number;
  value: TMessage;
}

export interface ProtocolValidationFailure {
  ok: false;
  error: string;
}

type UnknownRecord = Record<string, unknown>;

const HOST_TO_RUNNER_TYPES = new Set<SandboxMessageType>(['run_request', 'run_abort']);
const RUNNER_TO_HOST_TYPES = new Set<SandboxMessageType>([
  'runner_ready',
  'run_ack',
  'run_log',
  'run_stdout',
  'run_stderr',
  'run_test_result',
  'run_metrics',
  'run_error',
  'run_done',
]);
const ALL_TYPES = new Set<SandboxMessageType>([...HOST_TO_RUNNER_TYPES, ...RUNNER_TO_HOST_TYPES]);

const textEncoder = new TextEncoder();

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function isNetworkPolicy(value: unknown): value is NetworkPolicy {
  return value === 'deny' || value === 'restricted';
}

function isArtifactEncoding(value: unknown): value is ArtifactEncoding {
  return value === 'utf-8' || value === 'base64';
}

function isArtifactPersistenceMode(value: unknown): value is ArtifactPersistenceMode {
  return value === 'none' || value === 'just-bash';
}

function isRunTerminalStatus(value: unknown): value is RunTerminalStatus {
  return value === 'succeeded' || value === 'failed' || value === 'timed_out' || value === 'aborted' || value === 'limit_exceeded';
}

function isTestStatus(value: unknown): value is TestStatus {
  return value === 'passed' || value === 'failed' || value === 'skipped';
}

function getMessageBytes(value: unknown): number | null {
  try {
    return textEncoder.encode(JSON.stringify(value)).length;
  } catch {
    return null;
  }
}

export function resolveRunLimits(limits?: Partial<RunLimits>): RunLimits {
  return {
    maxRuntimeMs: limits?.maxRuntimeMs ?? DEFAULT_RUN_LIMITS.maxRuntimeMs,
    maxStdoutBytes: limits?.maxStdoutBytes ?? DEFAULT_RUN_LIMITS.maxStdoutBytes,
    maxStderrBytes: limits?.maxStderrBytes ?? DEFAULT_RUN_LIMITS.maxStderrBytes,
    maxLogBytes: limits?.maxLogBytes ?? DEFAULT_RUN_LIMITS.maxLogBytes,
    maxEventCount: limits?.maxEventCount ?? DEFAULT_RUN_LIMITS.maxEventCount,
    maxArtifactBytes: limits?.maxArtifactBytes ?? DEFAULT_RUN_LIMITS.maxArtifactBytes,
    maxWorkspaceBytes: limits?.maxWorkspaceBytes ?? DEFAULT_RUN_LIMITS.maxWorkspaceBytes,
  };
}

export function createSandboxMessage<TType extends SandboxMessageType, TPayload>(
  type: TType,
  ids: { sessionId: string; runId: string },
  payload: TPayload,
  timestamp = Date.now(),
): SandboxEnvelope<TType, TPayload> {
  return {
    protocolVersion: SANDBOX_PROTOCOL_VERSION,
    sessionId: ids.sessionId,
    runId: ids.runId,
    timestamp,
    type,
    payload,
  };
}

function validateRunRequest(request: unknown): request is RunRequest {
  if (!isRecord(request)) {
    return false;
  }

  if (!Array.isArray(request.files) || !request.files.every((file) => isRecord(file) && isNonEmptyString(file.path) && typeof file.content === 'string')) {
    return false;
  }

  if (!isRecord(request.command) || !isNonEmptyString(request.command.command)) {
    return false;
  }

  if (request.command.args !== undefined && !isStringArray(request.command.args)) {
    return false;
  }

  if (request.command.cwd !== undefined && !isNonEmptyString(request.command.cwd)) {
    return false;
  }

  if (request.title !== undefined && !isNonEmptyString(request.title)) {
    return false;
  }

  if (request.timeoutMs !== undefined && !isFiniteNumber(request.timeoutMs)) {
    return false;
  }

  if (request.networkPolicy !== undefined && !isNetworkPolicy(request.networkPolicy)) {
    return false;
  }

  if (request.metadata !== undefined && !isStringRecord(request.metadata)) {
    return false;
  }

  if (request.capturePaths !== undefined && !isStringArray(request.capturePaths)) {
    return false;
  }

  if (request.persist !== undefined) {
    if (!isRecord(request.persist) || !isArtifactPersistenceMode(request.persist.mode)) {
      return false;
    }
    if (request.persist.rootDir !== undefined && !isNonEmptyString(request.persist.rootDir)) {
      return false;
    }
  }

  if (request.limits !== undefined) {
    if (!isRecord(request.limits)) {
      return false;
    }
    for (const value of Object.values(request.limits)) {
      if (!isFiniteNumber(value)) {
        return false;
      }
    }
  }

  return true;
}

function validateArtifacts(value: unknown): value is ExecutionArtifact[] {
  return Array.isArray(value)
    && value.every((artifact) => isRecord(artifact)
      && isNonEmptyString(artifact.path)
      && typeof artifact.content === 'string'
      && (artifact.encoding === undefined || isArtifactEncoding(artifact.encoding)));
}

function validatePayload(type: SandboxMessageType, payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  switch (type) {
    case 'runner_ready':
      return (payload.adapter === 'mock' || payload.adapter === 'webcontainer' || payload.adapter === 'unavailable')
        && typeof payload.supportsAbort === 'boolean'
        && isNetworkPolicy(payload.networkPolicy);
    case 'run_request':
      return validateRunRequest(payload.request);
    case 'run_ack':
      return isFiniteNumber(payload.acceptedAt);
    case 'run_log':
      return isLogLevel(payload.level) && typeof payload.chunk === 'string' && isFiniteNumber(payload.bytes);
    case 'run_stdout':
    case 'run_stderr':
      return typeof payload.chunk === 'string' && isFiniteNumber(payload.bytes);
    case 'run_test_result':
      return isNonEmptyString(payload.suite)
        && isNonEmptyString(payload.name)
        && isTestStatus(payload.status)
        && (payload.durationMs === undefined || isFiniteNumber(payload.durationMs))
        && (payload.details === undefined || typeof payload.details === 'string');
    case 'run_metrics':
      return isFiniteNumber(payload.wallClockMs)
        && isFiniteNumber(payload.stdoutBytes)
        && isFiniteNumber(payload.stderrBytes)
        && isFiniteNumber(payload.logBytes)
        && isFiniteNumber(payload.eventCount)
        && isFiniteNumber(payload.artifactBytes);
    case 'run_error':
      return isNonEmptyString(payload.code)
        && isNonEmptyString(payload.message)
        && typeof payload.fatal === 'boolean'
        && (payload.phase === undefined || isNonEmptyString(payload.phase))
        && (payload.details === undefined || typeof payload.details === 'string');
    case 'run_done':
      return isFiniteNumber(payload.exitCode)
        && isRunTerminalStatus(payload.status)
        && (payload.reason === undefined || typeof payload.reason === 'string')
        && (payload.artifacts === undefined || validateArtifacts(payload.artifacts));
    case 'run_abort':
      return payload.reason === undefined || typeof payload.reason === 'string';
    default:
      return false;
  }
}

function validateDirection(type: SandboxMessageType, direction: ProtocolValidationOptions['direction']): boolean {
  if (!direction || direction === 'any') {
    return true;
  }

  if (direction === 'host-to-runner') {
    return HOST_TO_RUNNER_TYPES.has(type);
  }

  return RUNNER_TO_HOST_TYPES.has(type);
}

export function validateSandboxMessage(
  input: unknown,
  options: ProtocolValidationOptions = {},
): ProtocolValidationSuccess | ProtocolValidationFailure {
  const bytes = getMessageBytes(input);
  if (bytes === null) {
    return { ok: false, error: 'Message is not serializable.' };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  if (bytes > maxBytes) {
    return { ok: false, error: `Message exceeds byte limit of ${maxBytes}.` };
  }

  if (!isRecord(input)) {
    return { ok: false, error: 'Message must be an object.' };
  }

  if (input.protocolVersion !== SANDBOX_PROTOCOL_VERSION) {
    return { ok: false, error: 'Message has an invalid protocolVersion.' };
  }

  if (!isNonEmptyString(input.sessionId)) {
    return { ok: false, error: 'Message is missing a valid sessionId.' };
  }

  if (!isNonEmptyString(input.runId)) {
    return { ok: false, error: 'Message is missing a valid runId.' };
  }

  if (!isFiniteNumber(input.timestamp)) {
    return { ok: false, error: 'Message is missing a valid timestamp.' };
  }

  if (!isNonEmptyString(input.type) || !ALL_TYPES.has(input.type as SandboxMessageType)) {
    return { ok: false, error: 'Message type is unknown.' };
  }

  const type = input.type as SandboxMessageType;
  if (!validateDirection(type, options.direction)) {
    return { ok: false, error: `Message type ${type} is not valid for ${options.direction}.` };
  }

  if (options.expectedSessionId && input.sessionId !== options.expectedSessionId) {
    return { ok: false, error: 'Message sessionId does not match the active session.' };
  }

  if (options.expectedRunId && input.runId !== options.expectedRunId) {
    return { ok: false, error: 'Message runId does not match the active run.' };
  }

  if (!validatePayload(type, input.payload)) {
    return { ok: false, error: `Message payload is invalid for ${type}.` };
  }

  return {
    ok: true,
    bytes,
    value: input as unknown as SandboxMessage,
  };
}

export function isTerminalRunnerMessage(message: RunnerToHostMessage): message is RunDoneMessage | RunErrorMessage {
  return message.type === 'run_done' || message.type === 'run_error';
}
