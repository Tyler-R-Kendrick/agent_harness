import {
  capture,
  gen,
  grm,
  join,
  select,
  type GrammarNode,
} from 'guidance-ts/src/gen';
import {
  constrainToJsonSchema,
  constrainToToon,
  type ConstrainedDecoding,
  type GuidanceTsGrammar,
  type JsonSchema,
} from './constrainedDecoding.js';
import { textFragmentPattern, withMaxTokens } from './guidanceGrammarUtils.js';

export type GuidanceProfileId =
  | 'voter-decision'
  | 'decider-decision'
  | 'citation-list'
  | 'raw-markdown'
  | 'memory-toon-record';

export interface GuidanceProfile {
  id: GuidanceProfileId;
  purpose: string;
  maxTokens: number;
  grammar: GuidanceTsGrammar;
  schema?: JsonSchema;
  storageFormat?: 'JSON' | 'Markdown' | 'TOON';
}

interface GuidanceProfileDefinition extends Omit<GuidanceProfile, 'grammar'> {
  createGrammar: () => GrammarNode;
}

const VOTER_DECISION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { enum: ['APPROVE', 'REJECT'] },
    reason: { type: 'string', maxLength: 160 },
  },
  required: ['verdict', 'reason'],
};

const DECIDER_DECISION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { enum: ['COMMIT', 'ABORT'] },
    reason: { type: 'string', maxLength: 120 },
  },
  required: ['decision', 'reason'],
};

const CITATION_LIST_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    citations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claimId: { type: 'string' },
          sourceId: { type: 'string' },
          locator: { type: 'string' },
          supports: { enum: ['direct', 'inferred', 'conflicting'] },
        },
        required: ['claimId', 'sourceId', 'supports'],
      },
    },
  },
  required: ['citations'],
};

const PROFILE_DEFINITIONS: GuidanceProfileDefinition[] = [
  {
    id: 'voter-decision',
    purpose: 'Constrain voter agents to one verdict and one short reason.',
    maxTokens: 32,
    createGrammar: buildVoterDecisionGrammar,
    schema: VOTER_DECISION_SCHEMA,
  },
  {
    id: 'decider-decision',
    purpose: 'Constrain decider agents to commit or abort without narrative rationale.',
    maxTokens: 24,
    createGrammar: buildDeciderDecisionGrammar,
    schema: DECIDER_DECISION_SCHEMA,
  },
  {
    id: 'citation-list',
    purpose: 'Represent citation preferences as structured citation records.',
    maxTokens: 160,
    createGrammar: buildCitationListGrammar,
    schema: CITATION_LIST_SCHEMA,
    storageFormat: 'JSON',
  },
  {
    id: 'raw-markdown',
    purpose: 'Bound a raw markdown response section without inventing a renderer format.',
    maxTokens: 512,
    createGrammar: buildRawMarkdownGrammar,
    storageFormat: 'Markdown',
  },
  {
    id: 'memory-toon-record',
    purpose: 'Store reusable memory facts as key-addressed TOON records.',
    maxTokens: 96,
    createGrammar: buildMemoryToonRecordGrammar,
    storageFormat: 'TOON',
  },
];

export function getGuidanceProfiles(): GuidanceProfile[] {
  return PROFILE_DEFINITIONS.map(materializeProfile);
}

export function getGuidanceProfile(id: GuidanceProfileId): GuidanceProfile {
  const definition = PROFILE_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) {
    throw new Error(`Unknown guidance profile: ${id}`);
  }
  return materializeProfile(definition);
}

export function constrainedDecodingForGuidanceProfile(id: GuidanceProfileId): ConstrainedDecoding {
  const profile = getGuidanceProfile(id);
  if (profile.schema) {
    return constrainToJsonSchema(profile.schema, {
      maxTokens: profile.maxTokens,
      grammar: profile.grammar,
    });
  }
  return constrainToToon({
    maxTokens: profile.maxTokens,
    grammar: profile.grammar,
  });
}

export function buildVoterDecisionGrammar(): GrammarNode {
  return withMaxTokens(grm`{"verdict":"${capture('verdict', select('APPROVE', 'REJECT'))}","reason":"${gen('reason', textFragmentPattern(160), { stop: '"' })}"}`, 32);
}

export function buildDeciderDecisionGrammar(): GrammarNode {
  return withMaxTokens(grm`{"decision":"${capture('decision', select('COMMIT', 'ABORT'))}","reason":"${gen('reason', textFragmentPattern(120), { stop: '"' })}"}`, 24);
}

export function buildCitationListGrammar(): GrammarNode {
  return withMaxTokens(grm`{"citations":${select(
    '[]',
    join('[', citationItemGrammar(0), ']'),
    join('[', citationItemGrammar(0), ',', citationItemGrammar(1), ']'),
    join('[', citationItemGrammar(0), ',', citationItemGrammar(1), ',', citationItemGrammar(2), ']'),
  )}}`, 160);
}

export function buildRawMarkdownGrammar(): GrammarNode {
  return withMaxTokens(gen('markdown', /[\s\S]*/, { maxTokens: 512 }), 512);
}

export function buildMemoryToonRecordGrammar(): GrammarNode {
  return withMaxTokens(grm`\
    key: ${gen('key', /[A-Za-z0-9_.-]{1,96}/, { stop: '\n' })}
    value: ${gen('value', /[^\r\n]{1,240}/, { stop: '\n' })}
    tags[3]:
    - ${gen('tags', /[A-Za-z0-9_.-]{0,40}/, { stop: '\n', listAppend: true })}
    - ${gen('tags', /[A-Za-z0-9_.-]{0,40}/, { stop: '\n', listAppend: true })}
    - ${gen('tags', /[A-Za-z0-9_.-]{0,40}/, { listAppend: true })}
  `, 96);
}

function materializeProfile(definition: GuidanceProfileDefinition): GuidanceProfile {
  return {
    id: definition.id,
    purpose: definition.purpose,
    maxTokens: definition.maxTokens,
    grammar: definition.createGrammar(),
    ...(definition.schema ? { schema: definition.schema } : {}),
    ...(definition.storageFormat ? { storageFormat: definition.storageFormat } : {}),
  };
}

function citationItemGrammar(index: number): GrammarNode {
  return grm`{"claimId":"${gen(`citation.${index}.claimId`, /[^"\r\n]{1,80}/, { stop: '"' })}","sourceId":"${gen(`citation.${index}.sourceId`, /[^"\r\n]{1,120}/, { stop: '"' })}","locator":"${gen(`citation.${index}.locator`, /[^"\r\n]{0,80}/, { stop: '"' })}","supports":"${capture(`citation.${index}.supports`, select('direct', 'inferred', 'conflicting'))}"}`;
}
