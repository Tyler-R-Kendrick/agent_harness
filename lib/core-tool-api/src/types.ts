export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ToolConvention = 'mcp' | 'openapi' | 'json-schema';

export interface ToolDefinition<TInput extends JsonValue = JsonValue> {
  name: string;
  title: string;
  description: string;
  convention: ToolConvention;
  inputSchema: JsonValue;
  execute: (input: TInput, context: ToolRuntimeContext) => Promise<JsonValue>;
}

export interface ToolRuntimeContext {
  requestId: string;
  project: string;
  capabilities: readonly string[];
}

export interface ToolProvider {
  id: string;
  kind: 'native' | 'wasi-wasm';
  supports(tool: ToolDefinition): boolean;
  invoke(tool: ToolDefinition, input: JsonValue, context: ToolRuntimeContext): Promise<JsonValue>;
}

export interface WasiBindings {
  world: string;
  imports: Record<string, unknown>;
}

export interface WasiToolProvider extends ToolProvider {
  kind: 'wasi-wasm';
  wasi: WasiBindings;
}
