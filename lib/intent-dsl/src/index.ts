// Public API barrel for @agent-harness/intent-dsl. Excluded from coverage.

export {
  parseIntentProgram,
  toLarkGrammar,
  tokenize,
  type IntentProgram,
  type IntentStatement,
  type ParseResult,
  type Token,
  type TokenKind,
} from './canonicalGrammar';
export {
  approximateTokens,
  canonicalize,
  expand,
  minify,
  verifyRoundTrip,
  tokenize as tokenizeMinMap,
  type MinMap,
  type MinMapEntry,
  type MinifiedDocument,
  type SavingsReport,
} from './minmap';
export {
  DEFAULT_INTENT_DOMAIN,
  buildDefaultIntentGrammarDefinition,
  getIntentGrammar,
  listIntentGrammars,
  registerIntentGrammar,
  type IntentGrammarDefinition,
  type IntentGrammarEntry,
} from './grammarRegistry';
export {
  INTENT_DSL_DECODE_HOOK_ID,
  INTENT_DSL_GRAMMAR_HOOK_ID,
  INTENT_DSL_GRAMMAR_PLUGIN_ID,
  INTENT_DSL_SOURCE_PACKAGE,
  createIntentDslGrammarPlugin,
} from './plugin';
