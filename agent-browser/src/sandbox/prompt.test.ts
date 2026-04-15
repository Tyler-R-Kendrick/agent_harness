import { describe, expect, it } from 'vitest';
import { parseSandboxPrompt } from './prompt';

describe('sandbox prompt parsing', () => {
  it('parses a one-shot sandbox command with capture and persist directives', () => {
    const parsed = parseSandboxPrompt(`/sandbox node index.js\ncapture: dist/out.txt\npersist: /workspace/generated\n\n\
\`\`\`js file=index.js
console.log('hello')
\`\`\``);

    expect(parsed).not.toBeNull();
    expect(parsed?.request.command).toEqual({ command: 'node', args: ['index.js'] });
    expect(parsed?.request.capturePaths).toEqual(['dist/out.txt']);
    expect(parsed?.request.persist).toEqual({ mode: 'just-bash', rootDir: '/workspace/generated' });
    expect(parsed?.request.files[0]).toEqual({ path: 'index.js', content: "console.log('hello')\n" });
  });

  it('returns null for ordinary chat prompts', () => {
    expect(parseSandboxPrompt('Summarize the workspace rules.')).toBeNull();
  });
});
