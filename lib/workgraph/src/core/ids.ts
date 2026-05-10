export interface WorkGraphIdFactory {
  next(): string;
}

export function createSequentialWorkGraphIdFactory(prefix = 'wg'): WorkGraphIdFactory {
  let sequence = 0;
  return {
    next() {
      sequence += 1;
      return `${prefix}-${String(sequence).padStart(4, '0')}`;
    },
  };
}
