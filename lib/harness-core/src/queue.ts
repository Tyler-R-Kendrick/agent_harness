export type QueueMode = 'all' | 'one-at-a-time';

export class PendingMessageQueue<TMessage> {
  private readonly messages: TMessage[] = [];

  constructor(public mode: QueueMode = 'one-at-a-time') {}

  get size(): number {
    return this.messages.length;
  }

  enqueue(message: TMessage): void {
    this.messages.push(message);
  }

  hasItems(): boolean {
    return this.messages.length > 0;
  }

  clear(): void {
    this.messages.splice(0, this.messages.length);
  }

  drain(): TMessage[] {
    if (this.mode === 'all') {
      return this.messages.splice(0, this.messages.length);
    }
    const message = this.messages.shift();
    return message === undefined ? [] : [message];
  }
}
