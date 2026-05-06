export type ProviderId = string & { readonly __brand: 'ProviderId' };
export type WorkerTypeId = string & { readonly __brand: 'WorkerTypeId' };
export type RuntimeTypeId = string & { readonly __brand: 'RuntimeTypeId' };
export type SandboxTypeId = string & { readonly __brand: 'SandboxTypeId' };
export type CapabilityId = string & { readonly __brand: 'CapabilityId' };
export type EventTypeId = string & { readonly __brand: 'EventTypeId' };
export type JobIntentId = string & { readonly __brand: 'JobIntentId' };

function opaqueId<T extends string>(kind: string, value: string): T {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${kind} must be a non-empty string.`);
  }
  return value as T;
}

export function providerId(value: string): ProviderId {
  return opaqueId<ProviderId>('ProviderId', value);
}

export function workerTypeId(value: string): WorkerTypeId {
  return opaqueId<WorkerTypeId>('WorkerTypeId', value);
}

export function runtimeTypeId(value: string): RuntimeTypeId {
  return opaqueId<RuntimeTypeId>('RuntimeTypeId', value);
}

export function sandboxTypeId(value: string): SandboxTypeId {
  return opaqueId<SandboxTypeId>('SandboxTypeId', value);
}

export function capabilityId(value: string): CapabilityId {
  return opaqueId<CapabilityId>('CapabilityId', value);
}

export function eventTypeId(value: string): EventTypeId {
  return opaqueId<EventTypeId>('EventTypeId', value);
}

export function jobIntentId(value: string): JobIntentId {
  return opaqueId<JobIntentId>('JobIntentId', value);
}
