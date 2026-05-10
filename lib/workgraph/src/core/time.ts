export type WorkGraphTimeSource = () => string;

export function createFixedWorkGraphTimeSource(timestamp: string): WorkGraphTimeSource {
  return () => timestamp;
}

export function createSystemWorkGraphTimeSource(): WorkGraphTimeSource {
  return () => new Date().toISOString();
}
