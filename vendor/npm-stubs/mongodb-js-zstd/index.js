export async function compress() {
  throw new Error("Native zstd compression is unavailable in this install.");
}

export async function decompress() {
  throw new Error("Native zstd decompression is unavailable in this install.");
}
