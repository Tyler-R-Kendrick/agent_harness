import { canonicalJson } from './canonicalJson';
import { decodeCompressedText, encodeCompressedText } from './encoding';

export async function encodePayload(value: unknown): Promise<string> {
  return encodeCompressedText(canonicalJson(value));
}

export async function decodePayload(value: string): Promise<unknown> {
  return JSON.parse(await decodeCompressedText(value));
}

export async function compressSdp(sdp: string): Promise<string> {
  return encodeCompressedText(sdp);
}

export async function decompressSdp(value: string): Promise<string> {
  return decodeCompressedText(value);
}
