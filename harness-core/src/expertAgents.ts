export type SketchOfThoughtParadigm =
  | 'chunked_symbolism'
  | 'conceptual_chaining'
  | 'expert_lexicons'
  | 'cot';

export interface SketchOfThoughtExpertAgentOptions {
  paradigm?: SketchOfThoughtParadigm | 'auto';
  topic: string;
  topicDescription?: string;
  expertLexiconSummary: string;
  maxTokens?: number;
}

export function buildSketchOfThoughtSystemPrompt(
  options: SketchOfThoughtExpertAgentOptions,
): string {
  const paradigm = options.paradigm && options.paradigm !== 'auto'
    ? options.paradigm
    : resolveSketchOfThoughtParadigm([
      options.topic,
      options.topicDescription,
      options.expertLexiconSummary,
    ].filter(Boolean).join(' '));

  return [
    promptHeader(paradigm),
    `Topic: ${options.topic}`,
    options.topicDescription?.trim() ? `Topic detail: ${options.topicDescription}` : null,
    `Compression hints: ${options.expertLexiconSummary}`,
    promptMethod(paradigm),
    'Output shape:',
    '[shorthand reasoning]',
    '\\boxed{[final answer]}',
  ].filter(Boolean).join('\n');
}

export function buildSketchOfThoughtExpertAgentPrompt(options: SketchOfThoughtExpertAgentOptions): string {
  return buildSketchOfThoughtSystemPrompt({
    ...options,
    paradigm: options.paradigm ?? 'expert_lexicons',
  });
}

export function resolveSketchOfThoughtParadigm(question: string): SketchOfThoughtParadigm {
  const lowered = question.toLowerCase();
  if (/(chain[-\s]?of[-\s]?thought|show your work|explain every|numbered steps|audit trail|assumptions)/.test(lowered)) {
    return 'cot';
  }
  if (/(diagnose|compiler|typescript|ast|cfg|sae|residual|medical|triage|engineering|pid|api|schema)/.test(lowered)) {
    return 'expert_lexicons';
  }
  if (/(calculate|compute|equation|formula|unit|units|convert|apples|percent|ratio|\d)/.test(lowered)) {
    return 'chunked_symbolism';
  }
  return 'conceptual_chaining';
}

function promptHeader(paradigm: SketchOfThoughtParadigm): string {
  switch (paradigm) {
    case 'chunked_symbolism':
      return '## Sketch-of-Thought: Chunked Symbolism';
    case 'conceptual_chaining':
      return '## Sketch-of-Thought: Conceptual Chaining';
    case 'expert_lexicons':
      return '## Sketch-of-Thought Expert Agent: Expert Lexicons';
    case 'cot':
      return '## Chain-of-Thought Baseline';
  }
}

function promptMethod(paradigm: SketchOfThoughtParadigm): string {
  switch (paradigm) {
    case 'chunked_symbolism':
      return [
        'Use variables, equations, one computation per line, and explicit units.',
        'Keep wording minimal; do not restate the problem.',
      ].join('\n');
    case 'conceptual_chaining':
      return [
        'Extract key concepts and connect them with → in a meaningful sequence.',
        'Use associative recall and multi-hop links with minimal words.',
      ].join('\n');
    case 'expert_lexicons':
      return [
        'Use Expert Lexicons: domain shorthand, technical symbols, and compact structured notation.',
        'No full-sentence chain-of-thought; preserve technical accuracy and information density.',
      ].join('\n');
    case 'cot':
      return [
        'Use a numbered chain-of-thought baseline only when explicit step visibility is required.',
        'State assumptions, verify the answer, and keep the boxed answer single and concise.',
      ].join('\n');
  }
}
