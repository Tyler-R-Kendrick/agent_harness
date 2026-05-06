import variant from '@jitl/quickjs-ng-wasmfile-release-sync';
import {
  newQuickJSWASMModule,
  shouldInterruptAfterDeadline,
  type QuickJSDeferredPromise,
  type QuickJSHandle,
  type QuickJSContext,
  type QuickJSWASMModule,
} from 'quickjs-emscripten';
import { SandboxExecutionError } from './errors';
import { SandboxFetchPolicy, type SandboxFetchPolicyOptions, type SandboxFetchResponse } from './network';

export interface JavaScriptExecutionOptions {
  filename?: string;
  timeoutMs: number;
  allowNetwork: boolean;
  network?: SandboxFetchPolicyOptions;
}

export interface JavaScriptExecutionResult {
  output: string;
  exitCode: number;
}

export interface JavaScriptExecutor {
  execute(source: string, options: JavaScriptExecutionOptions): Promise<JavaScriptExecutionResult>;
}

export interface QuickJsJavaScriptExecutorOptions {
  fetchImplementation?: typeof fetch;
  network?: SandboxFetchPolicyOptions;
}

let quickJsModulePromise: Promise<QuickJSWASMModule> | null = null;

function loadQuickJsModule(): Promise<QuickJSWASMModule> {
  quickJsModulePromise ??= newQuickJSWASMModule(variant);
  return quickJsModulePromise;
}

function formatConsoleValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined) {
    return 'undefined';
  }
  return String(value);
}

function formatConsoleLine(values: unknown[]): string {
  return values.map(formatConsoleValue).join(' ');
}

function formatError(value: unknown): string {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = String((value as { message: unknown }).message);
    const name = 'name' in value ? String((value as { name: unknown }).name) : 'Error';
    return `${name}: ${message}`;
  }
  return String(value);
}

function setStringProp(vm: QuickJSContext, objectHandle: QuickJSHandle, key: string, value: string): void {
  const handle = vm.newString(value);
  vm.setProp(objectHandle, key, handle);
  handle.dispose();
}

function setNumberProp(vm: QuickJSContext, objectHandle: QuickJSHandle, key: string, value: number): void {
  const handle = vm.newNumber(value);
  vm.setProp(objectHandle, key, handle);
  handle.dispose();
}

function setBooleanProp(vm: QuickJSContext, objectHandle: QuickJSHandle, key: string, value: boolean): void {
  vm.setProp(objectHandle, key, value ? vm.true : vm.false);
}

function createResolvedPromise(vm: QuickJSContext, value: QuickJSHandle, deferreds: QuickJSDeferredPromise[]): QuickJSHandle {
  const promise = vm.newPromise();
  deferreds.push(promise);
  promise.resolve(value);
  void promise.settled.then(vm.runtime.executePendingJobs);
  return promise.handle;
}

function createJsonHandle(vm: QuickJSContext, bodyText: string): QuickJSHandle {
  const parsed = JSON.parse(bodyText);
  const result = vm.evalCode(`(${JSON.stringify(parsed)})`);
  /* c8 ignore start */
  if (result.error) {
    const message = formatError(vm.dump(result.error));
    result.error.dispose();
    throw new SandboxExecutionError(message);
  }
  /* c8 ignore stop */
  return result.value;
}

function createFetchResponseHandle(
  vm: QuickJSContext,
  response: SandboxFetchResponse,
  handles: QuickJSHandle[],
  deferreds: QuickJSDeferredPromise[],
): QuickJSHandle {
  const responseObject = vm.newObject();
  handles.push(responseObject);
  setStringProp(vm, responseObject, 'url', response.url);
  setNumberProp(vm, responseObject, 'status', response.status);
  setStringProp(vm, responseObject, 'statusText', response.statusText);
  setBooleanProp(vm, responseObject, 'ok', response.ok);
  setBooleanProp(vm, responseObject, 'truncated', response.truncated);

  const headersObject = vm.newObject();
  handles.push(headersObject);
  const getHeaderFunction = vm.newFunction('get', (nameHandle) => {
    const name = vm.getString(nameHandle).toLowerCase();
    const value = response.headers[name];
    if (value === undefined) {
      return vm.null;
    }
    const valueHandle = vm.newString(value);
    handles.push(valueHandle);
    return valueHandle;
  });
  handles.push(getHeaderFunction);
  vm.setProp(headersObject, 'get', getHeaderFunction);
  vm.setProp(responseObject, 'headers', headersObject);

  const textFunction = vm.newFunction('text', () => {
    const valueHandle = vm.newString(response.bodyText);
    handles.push(valueHandle);
    return createResolvedPromise(vm, valueHandle, deferreds);
  });
  handles.push(textFunction);
  vm.setProp(responseObject, 'text', textFunction);

  const jsonFunction = vm.newFunction('json', () => {
    const valueHandle = createJsonHandle(vm, response.bodyText);
    handles.push(valueHandle);
    return createResolvedPromise(vm, valueHandle, deferreds);
  });
  handles.push(jsonFunction);
  vm.setProp(responseObject, 'json', jsonFunction);

  return responseObject;
}

export class QuickJsJavaScriptExecutor implements JavaScriptExecutor {
  constructor(private readonly options: QuickJsJavaScriptExecutorOptions = {}) {}

  async execute(source: string, options: JavaScriptExecutionOptions): Promise<JavaScriptExecutionResult> {
    const quickJs = await loadQuickJsModule();
    const runtime = quickJs.newRuntime();
    const vm = runtime.newContext();
    const output: string[] = [];
    const handles: QuickJSHandle[] = [];
    const deferreds: QuickJSDeferredPromise[] = [];

    runtime.setMemoryLimit(16 * 1024 * 1024);
    runtime.setMaxStackSize(1024 * 1024);
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + options.timeoutMs));

    const consoleObject = vm.newObject();
    handles.push(consoleObject);

    const bindConsole = (name: 'log' | 'warn' | 'error', prefix: string) => {
      const fn = vm.newFunction(name, (...args) => {
        const line = formatConsoleLine(args.map((arg) => vm.dump(arg)));
        output.push(prefix ? `${prefix} ${line}` : line);
      });
      handles.push(fn);
      vm.setProp(consoleObject, name, fn);
    };

    bindConsole('log', '');
    bindConsole('warn', '[warn]');
    bindConsole('error', '[error]');
    vm.setProp(vm.global, 'console', consoleObject);

    if (options.allowNetwork) {
      const fetchPolicy = new SandboxFetchPolicy({
        ...this.options.network,
        ...options.network,
        enabled: true,
        fetchImplementation: options.network?.fetchImplementation ?? this.options.fetchImplementation ?? this.options.network?.fetchImplementation,
      });
      const fetchFunction = vm.newFunction('fetch', (inputHandle, initHandle) => {
        const promise = vm.newPromise();
        deferreds.push(promise);
        void fetchPolicy.fetch(vm.dump(inputHandle), initHandle ? vm.dump(initHandle) : undefined)
          .then((response) => {
            const responseHandle = createFetchResponseHandle(vm, response, handles, deferreds);
            promise.resolve(responseHandle);
          })
          .catch((error) => {
            const errorHandle = vm.newError(error instanceof Error ? error.message : String(error));
            handles.push(errorHandle);
            promise.reject(errorHandle);
          })
          .finally(() => {
            runtime.executePendingJobs();
          });
        return promise.handle;
      });
      handles.push(fetchFunction);
      vm.setProp(vm.global, 'fetch', fetchFunction);
    }

    try {
      const result = vm.evalCode(source, options.filename);
      if (result.error) {
        const dumpedError = vm.dump(result.error);
        result.error.dispose();
        output.push(`[error] ${formatError(dumpedError)}`);
        return { output: output.join('\n'), exitCode: 1 };
      }
      const promiseState = vm.getPromiseState(result.value);
      if (promiseState.type === 'pending') {
        const resolved = await vm.resolvePromise(result.value);
        result.value.dispose();
        if (resolved.error) {
          const dumpedError = vm.dump(resolved.error);
          resolved.error.dispose();
          output.push(`[error] ${formatError(dumpedError)}`);
          return { output: output.join('\n'), exitCode: 1 };
        }
        resolved.value.dispose();
        return { output: output.join('\n'), exitCode: 0 };
      }
      result.value.dispose();
      if (promiseState.type === 'rejected') {
        const dumpedError = vm.dump(promiseState.error);
        promiseState.error.dispose();
        output.push(`[error] ${formatError(dumpedError)}`);
        return { output: output.join('\n'), exitCode: 1 };
      }
      if (!promiseState.notAPromise) {
        promiseState.value.dispose();
      }
      return { output: output.join('\n'), exitCode: 0 };
    } finally {
      for (const deferred of deferreds.reverse()) {
        deferred.dispose();
      }
      for (const handle of handles.reverse()) {
        if (handle.alive) {
          handle.dispose();
        }
      }
      vm.dispose();
      runtime.dispose();
    }
  }
}
