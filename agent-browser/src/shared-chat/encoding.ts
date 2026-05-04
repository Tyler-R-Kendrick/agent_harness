const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type EncodedTransfer =
  | { mode: 'single'; data: string }
  | { mode: 'chunked'; transferId: string; index: number; count: number; data: string };

export function utf8Encode(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function utf8Decode(value: Uint8Array): string {
  return textDecoder.decode(value);
}

export function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) {
    throw new Error('Invalid base64url input.');
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function asBlobPart(value: Uint8Array): BlobPart {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function deflateBytes(value: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    return value;
  }
  const stream = new Blob([asBlobPart(value)]).stream().pipeThrough(new CompressionStream('deflate'));
  return streamToBytes(stream as ReadableStream<Uint8Array>);
}

export async function inflateBytes(value: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    return value;
  }
  const stream = new Blob([asBlobPart(value)]).stream().pipeThrough(new DecompressionStream('deflate'));
  return streamToBytes(stream as ReadableStream<Uint8Array>);
}

export async function encodeCompressedText(value: string): Promise<string> {
  return base64UrlEncode(await deflateBytes(utf8Encode(value)));
}

export async function decodeCompressedText(value: string): Promise<string> {
  return utf8Decode(await inflateBytes(base64UrlDecode(value)));
}

export async function encodeTransfer(value: string): Promise<EncodedTransfer> {
  return { mode: 'single', data: await encodeCompressedText(value) };
}
