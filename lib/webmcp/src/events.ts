import type { ToolLifecycleDetail } from './types';

export const TOOL_ACTIVATED_EVENT = 'toolactivated';
export const TOOL_CANCELED_EVENT = 'toolcanceled';

class ToolLifecycleEvent extends Event {
  readonly detail: ToolLifecycleDetail;

  constructor(type: string, detail: ToolLifecycleDetail) {
    super(type);
    this.detail = detail;
  }
}

export function dispatchToolActivated(target: EventTarget, detail: ToolLifecycleDetail): boolean {
  return target.dispatchEvent(new ToolLifecycleEvent(TOOL_ACTIVATED_EVENT, detail));
}

export function dispatchToolCanceled(target: EventTarget, detail: ToolLifecycleDetail): boolean {
  return target.dispatchEvent(new ToolLifecycleEvent(TOOL_CANCELED_EVENT, detail));
}