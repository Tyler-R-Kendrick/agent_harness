export function applyAllowedTokenMaskInPlace(
  logits: Float32Array | number[],
  allowedTokenIds: Uint32Array
): void {
  const keep = new Uint8Array(logits.length);

  for (const tokenId of allowedTokenIds) {
    if (tokenId < keep.length) {
      keep[tokenId] = 1;
    }
  }

  for (let tokenId = 0; tokenId < logits.length; tokenId++) {
    if (keep[tokenId] !== 1) {
      logits[tokenId] = -Infinity;
    }
  }
}

export class TokenMaskApplier {
  private readonly marks: Uint32Array;
  private generation = 1;

  constructor(vocabSize: number) {
    this.marks = new Uint32Array(vocabSize);
  }

  apply(logits: Float32Array | number[], allowedTokenIds: Uint32Array): void {
    const generation = this.generation++;
    if (this.generation === 0xffffffff) {
      this.marks.fill(0);
      this.generation = 1;
    }

    for (const tokenId of allowedTokenIds) {
      if (tokenId < this.marks.length) {
        this.marks[tokenId] = generation;
      }
    }

    for (let tokenId = 0; tokenId < logits.length; tokenId++) {
      if (this.marks[tokenId] !== generation) {
        logits[tokenId] = -Infinity;
      }
    }
  }
}
