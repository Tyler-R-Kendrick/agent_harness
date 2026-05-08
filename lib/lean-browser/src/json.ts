export function extractFirstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      depth++;
    }
    if (char === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }
  return null;
}

export function parseModelJson<T>(text: string, schema: { parse(value: unknown): T }): T | null {
  try {
    const value = extractFirstJsonObject(text);
    return value === null ? null : schema.parse(value);
  } catch {
    return null;
  }
}

export function stringifyForPrompt(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
