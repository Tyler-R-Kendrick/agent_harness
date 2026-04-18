import type { ModelContextClientLike, UserInteractionCallback } from './types';

export interface ModelContextClientOptions {
  onRequestUserInteraction?: <TResult>(callback: UserInteractionCallback<TResult>) => TResult | Promise<TResult>;
}

export class ModelContextClient implements ModelContextClientLike {
  readonly #onRequestUserInteraction?: ModelContextClientOptions['onRequestUserInteraction'];

  constructor(options: ModelContextClientOptions = {}) {
    this.#onRequestUserInteraction = options.onRequestUserInteraction;
  }

  async requestUserInteraction<TResult = unknown>(callback: UserInteractionCallback<TResult>): Promise<TResult> {
    if (this.#onRequestUserInteraction) {
      return this.#onRequestUserInteraction(callback);
    }

    return callback();
  }
}