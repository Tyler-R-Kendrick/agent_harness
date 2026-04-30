import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/search-fulfillment/cases.jsonl');
const liveCasesPath = path.join(appRoot, 'evals/search-fulfillment/cases.live.jsonl');

const LOCATION = 'Arlington Heights, IL';
const LOCATION_QUERY = 'Arlington Heights IL';
const SEARCH_TURN_CONTEXT_MARKER = 'Agent Browser search turn context:';

const rankingGoals = [
  { id: 'best', prompt: 'best', queryPrefix: 'best' },
  { id: 'nearest', prompt: 'nearest', queryPrefix: 'nearest' },
  { id: 'closest', prompt: 'closest', queryPrefix: 'closest' },
  { id: 'worst', prompt: 'worst', queryPrefix: 'worst' },
  { id: 'most-popular', prompt: 'most popular', queryPrefix: 'most popular' },
  { id: 'highly-rated', prompt: 'highest rated', queryPrefix: 'highest rated' },
  { id: 'family-friendly', prompt: 'family-friendly', queryPrefix: 'family-friendly' },
  { id: 'open-now', prompt: 'open now', queryPrefix: 'open now' },
  { id: 'quiet', prompt: 'quiet', queryPrefix: 'quiet' },
  { id: 'budget-friendly', prompt: 'budget-friendly', queryPrefix: 'budget-friendly' },
  { id: 'near-me', prompt: 'near me', queryPrefix: 'nearby' },
  { id: 'recommended', prompt: 'recommended', queryPrefix: 'recommended' },
];

const domains = [
  {
    id: 'movie-theaters',
    subject: 'movie theaters',
    plural: 'movie theaters',
    entities: [
      ['AMC Randhurst 12', 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12', 'Mount Prospect near Arlington Heights'],
      ['CMX Arlington Heights', 'https://www.cmxcinemas.com/location/cmx-arlington-heights', 'Arlington Heights'],
      ['Classic Cinemas Elk Grove Theatre', 'https://www.classiccinemas.com/elk-grove', 'Elk Grove Village near Arlington Heights'],
    ],
  },
  {
    id: 'plays',
    subject: 'live plays and theaters',
    plural: 'live theater venues',
    entities: [
      ['Metropolis Performing Arts Centre', 'https://metropolisarts.com/', 'Arlington Heights'],
      ['Marriott Theatre', 'https://www.marriotttheatre.com/', 'Lincolnshire near Arlington Heights'],
      ['North Shore Center for the Performing Arts', 'https://northshorecenter.org/', 'Skokie near Arlington Heights'],
    ],
  },
  {
    id: 'parks',
    subject: 'parks',
    plural: 'parks',
    entities: [
      ['Lake Arlington Park', 'https://www.ahpd.org/parks/facility-details/lake-arlington/', 'Arlington Heights'],
      ['North School Park', 'https://www.ahpd.org/parks/facility-details/north-school-park/', 'Arlington Heights'],
      ['Busse Woods', 'https://fpdcc.com/places/locations/busse-woods/', 'Elk Grove Village near Arlington Heights'],
    ],
  },
  {
    id: 'cafes',
    subject: 'cafes',
    plural: 'cafes',
    entities: [
      ['Around Cafe', 'https://aroundcafe.com/', 'Arlington Heights'],
      ['CoCo & Blu', 'https://www.cocoandblu.com/', 'Arlington Heights'],
      ['Hey Nonny Cafe', 'https://www.heynonny.com/', 'Arlington Heights'],
    ],
  },
  {
    id: 'restaurants',
    subject: 'restaurants',
    plural: 'restaurants',
    entities: [
      ['Passero', 'https://www.passeroarlington.com/', 'Arlington Heights'],
      ['Mago Grill & Cantina', 'https://magogrill.com/', 'Arlington Heights'],
      ['Maharaj Indian Grill', 'https://www.maharajgrill.com/', 'Arlington Heights'],
    ],
  },
  {
    id: 'bars',
    subject: 'bars',
    plural: 'bars',
    entities: [
      ["Peggy Kinnane's Irish Restaurant & Pub", 'https://www.peggykinnanes.com/', 'Arlington Heights'],
      ['Hey Nonny', 'https://www.heynonny.com/', 'Arlington Heights'],
      ["Cortland's Garage", 'https://www.cortlandsgarage.com/', 'Arlington Heights'],
    ],
  },
  {
    id: 'museums',
    subject: 'museums',
    plural: 'museums',
    entities: [
      ['Arlington Heights Historical Museum', 'https://www.ahmuseum.org/', 'Arlington Heights'],
      ['Illinois Holocaust Museum', 'https://www.ilholocaustmuseum.org/', 'Skokie near Arlington Heights'],
      ["Kohl Children's Museum", 'https://www.kohlchildrensmuseum.org/', 'Glenview near Arlington Heights'],
    ],
  },
  {
    id: 'gyms',
    subject: 'gyms',
    plural: 'gyms',
    entities: [
      ['Arlington Ridge Center', 'https://www.ahpd.org/facilities/arlington-ridge-center/', 'Arlington Heights'],
      ['Planet Fitness Arlington Heights', 'https://www.planetfitness.com/gyms/arlington-heights-il', 'Arlington Heights'],
      ['LA Fitness Arlington Heights', 'https://www.lafitness.com/', 'Arlington Heights area'],
    ],
  },
  {
    id: 'bookstores',
    subject: 'bookstores',
    plural: 'bookstores',
    entities: [
      ['Barnes & Noble Arlington Heights', 'https://stores.barnesandnoble.com/store/2089', 'Arlington Heights'],
      ['Half Price Books Palatine', 'https://www.hpb.com/store?storeid=HPB-032', 'Palatine near Arlington Heights'],
      ['The Book Stall', 'https://www.thebookstall.com/', 'Winnetka near Arlington Heights'],
    ],
  },
  {
    id: 'music-venues',
    subject: 'music venues',
    plural: 'music venues',
    entities: [
      ['Hey Nonny', 'https://www.heynonny.com/', 'Arlington Heights'],
      ['Metropolis Performing Arts Centre', 'https://metropolisarts.com/', 'Arlington Heights'],
      ["Durty Nellie's", 'https://durtynellies.com/', 'Palatine near Arlington Heights'],
    ],
  },
];

const forbiddenLabels = [
  'At Home',
  'Movie Charts',
  'Movie News',
  'Movies',
  'Theaters',
  'TV Shows',
  'FanStore',
  'Streaming',
  'Coming Soon',
  'Skip to Main Content',
  'Moviefone TV',
  'Sign In/Join',
  'FanClub',
  'Fandango Ticketing Theaters My',
  'Featured Movie Animal Farm',
  'Movie Showimes',
  'IL 60004 Update Zipcode Monday',
  'Showtimes',
  'Cities Movie Times',
  'States Movie Times',
  'Zip Codes Movie Times',
  'Movie Times by Cities',
  'Movie Times by States',
  'Movie Times by Zip Codes',
  'Tickets',
  'Reviews',
  'Menu',
  'Directions',
  'Support Enable',
  'Join Now Enable',
  'Enable dark mode',
  'Shop Categories',
  'About Us',
  'Chicago Bound',
];

const priorEntities = {
  'movie-theaters': ['AMC South Barrington 24', 'https://www.amctheatres.com/movie-theatres/chicago/amc-south-barrington-24', 'South Barrington near Arlington Heights'],
  plays: ['Oil Lamp Theater', 'https://oillamptheater.org/', 'Glenview near Arlington Heights'],
  parks: ['Recreation Park', 'https://www.ahpd.org/parks/', 'Arlington Heights'],
  cafes: ['Uptown Cafe', 'https://fixtures.agent-browser.test/prior/uptown-cafe', 'Arlington Heights'],
  restaurants: ['Bar Salotto', 'https://www.barsalotto.com/', 'Arlington Heights'],
  bars: ['Sports Page Bar & Grill Arlington Heights', 'https://www.sportspagebarandgrill.com/', 'Arlington Heights'],
  museums: ['Des Plaines History Center', 'https://desplaineshistory.org/', 'Des Plaines near Arlington Heights'],
  gyms: ['Anytime Fitness Arlington Heights', 'https://www.anytimefitness.com/', 'Arlington Heights'],
  bookstores: ['Anderson\'s Bookshop', 'https://www.andersonsbookshop.com/', 'Naperville area'],
  'music-venues': ['Big Shot Piano Lounge', 'https://bigshotpianolounge.com/', 'Arlington Heights'],
};

const followUpVariants = [
  { id: 'show-me-3-more', text: () => 'show me 3 more', requestedCount: 3 },
  { id: 'show-me-more', text: () => 'show me more', requestedCount: 3 },
  { id: 'any-others', text: () => 'any others?', requestedCount: 3 },
  { id: 'closer-ones', text: () => 'closer ones', queryPrefix: 'closest', requestedCount: 3 },
  { id: 'open-now', text: () => 'show me more open now', queryPrefix: 'open now', requestedCount: 3 },
  { id: 'not-prior', text: (prior) => `not ${prior[0].split(/\s+/).slice(0, 3).join(' ')}, show me more`, requestedCount: 3 },
  { id: 'more-like-first', text: () => 'more like #1', requestedCount: 3 },
  { id: 'show-me-2-more', text: () => 'show me 2 more', requestedCount: 2 },
  { id: 'other-options', text: () => 'any other options?', requestedCount: 3 },
  { id: 'highly-rated', text: () => 'show me more highly rated', queryPrefix: 'highest rated', requestedCount: 3 },
  { id: 'budget-friendly', text: () => 'show me more budget-friendly', queryPrefix: 'budget-friendly', requestedCount: 3 },
  { id: 'quiet', text: () => 'show me more quiet', queryPrefix: 'quiet', requestedCount: 3 },
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function queryFor(domain, goal) {
  return `${goal.queryPrefix} ${domain.subject} Arlington Heights IL`;
}

function contextRankingGoal(goal) {
  switch (goal.id) {
    case 'best':
      return 'best';
    case 'nearest':
    case 'closest':
      return 'closest';
    case 'worst':
      return 'worst';
    case 'most-popular':
      return 'most-popular';
    case 'open-now':
      return 'open-now';
    case 'highly-rated':
      return 'highly-rated';
    case 'family-friendly':
      return 'family-friendly';
    case 'budget-friendly':
      return 'budget-friendly';
    case 'quiet':
      return 'quiet';
    case 'near-me':
      return 'nearby';
    case 'recommended':
      return 'recommended';
    default:
      return undefined;
  }
}

function queryPrefixForContextGoal(goal) {
  const mapped = contextRankingGoal(goal);
  switch (mapped) {
    case 'most-popular':
      return 'most popular';
    case 'open-now':
      return 'open now';
    case 'highly-rated':
      return 'highest rated';
    case 'family-friendly':
      return 'family-friendly';
    case 'budget-friendly':
      return 'budget-friendly';
    case 'nearby':
      return 'nearby';
    default:
      return mapped ?? goal.queryPrefix;
  }
}

function memoryFixture() {
  return {
    status: 'found',
    query: 'location',
    memories: [{
      id: 'location.city',
      label: 'Saved city',
      value: LOCATION,
      source: 'workspace-memory',
      updatedAt: '2026-04-26T00:00:00.000Z',
    }],
  };
}

function validationConstraint(input) {
  return {
    required: true,
    confidence: 0.9,
    validationMethod: input.type === 'format' ? 'answer-text' : 'structured-candidate',
    ...input,
  };
}

function validationContractFor({
  taskGoal,
  subject,
  location = LOCATION,
  requestedCount,
  excludedCandidates = [],
  prefix,
  suffix,
  rhyme,
  impossibleKind,
  impossibleReason,
}) {
  const constraints = [];
  if (requestedCount !== undefined) {
    constraints.push(validationConstraint({
      id: 'count:min-results',
      sourceText: taskGoal,
      type: 'count',
      operator: 'at_least',
      target: 'acceptedCandidates',
      value: requestedCount,
      failureMessage: `Expected at least ${requestedCount} accepted result(s).`,
    }));
  }
  if (subject) {
    constraints.push(validationConstraint({
      id: 'subject:entity-type',
      sourceText: taskGoal,
      type: 'subject',
      operator: 'matches',
      target: 'acceptedCandidates.subject',
      value: subject,
      failureMessage: `Results must be instances of ${subject}.`,
    }));
    constraints.push(validationConstraint({
      id: 'link:entity-specific',
      sourceText: taskGoal,
      type: 'entity_link',
      operator: 'has_safe_entity_link',
      target: 'acceptedCandidates.entityLink',
      value: true,
      failureMessage: 'Each rendered result needs a safe source-backed entity link.',
    }));
    constraints.push(validationConstraint({
      id: 'source:evidence',
      sourceText: taskGoal,
      type: 'source_evidence',
      operator: 'has_evidence',
      target: 'acceptedCandidates.sourceEvidence',
      value: true,
      failureMessage: 'Each rendered result needs source evidence.',
    }));
    constraints.push(validationConstraint({
      id: 'chrome:no-page-labels',
      sourceText: taskGoal,
      type: 'page_chrome',
      operator: 'rejects_page_chrome',
      target: 'finalAnswer.labels',
      value: true,
      failureMessage: 'Page chrome, navigation, source categories, and content buckets cannot be rendered as results.',
    }));
  }
  if (location) {
    constraints.push(validationConstraint({
      id: /\bnear|closest|nearest/i.test(taskGoal) ? 'location:nearby' : `location:${slug(location)}`,
      sourceText: taskGoal,
      type: 'location',
      operator: /\bnear|closest|nearest/i.test(taskGoal) ? 'near' : 'in',
      target: 'acceptedCandidates.locationEvidence',
      value: location,
      failureMessage: `Results need location or proximity evidence for ${location}.`,
    }));
  }
  if (prefix) {
    constraints.push(validationConstraint({
      id: 'name:prefix',
      sourceText: taskGoal,
      type: 'name_prefix',
      operator: 'starts_with',
      target: 'acceptedCandidates.name',
      value: prefix,
      failureMessage: `Result names must start with ${prefix}.`,
    }));
  }
  if (suffix) {
    constraints.push(validationConstraint({
      id: 'name:suffix',
      sourceText: taskGoal,
      type: 'name_suffix',
      operator: 'ends_with',
      target: 'acceptedCandidates.name',
      value: suffix,
      failureMessage: `Result names must end with ${suffix}.`,
    }));
  }
  if (rhyme) {
    constraints.push(validationConstraint({
      id: 'name:rhyme',
      sourceText: taskGoal,
      type: 'rhyme',
      operator: 'rhymes_with',
      target: 'acceptedCandidates.name',
      value: rhyme,
      failureMessage: `Result names must rhyme with ${rhyme}.`,
    }));
  }
  if (excludedCandidates.length > 0) {
    constraints.push(validationConstraint({
      id: 'exclude:prior-candidates',
      sourceText: taskGoal,
      type: 'exclusion',
      operator: 'excludes',
      target: 'acceptedCandidates.name',
      value: excludedCandidates,
      failureMessage: `Results must exclude ${excludedCandidates.join(', ')}.`,
    }));
  }
  const evidenceRequirements = [];
  if (constraints.some((constraint) => constraint.type === 'subject')) {
    evidenceRequirements.push({
      id: 'evidence:subject-instance',
      description: 'Evidence must show each result is an instance of the requested subject.',
      required: true,
      target: 'acceptedCandidates.subjectEvidence',
    });
  }
  if (constraints.some((constraint) => constraint.type === 'location')) {
    evidenceRequirements.push({
      id: 'evidence:location',
      description: 'Evidence must tie each result to the requested location or proximity.',
      required: true,
      target: 'acceptedCandidates.locationEvidence',
    });
  }
  if (constraints.some((constraint) => constraint.type === 'entity_link')) {
    evidenceRequirements.push({
      id: 'evidence:entity-link',
      description: 'Evidence must include a safe source-backed entity link.',
      required: true,
      target: 'acceptedCandidates.entityLink',
    });
  }
  return {
    type: 'validation-contract',
    version: 1,
    taskGoal,
    constraints,
    evidenceRequirements,
    impossibilityPolicy: impossibleKind
      ? {
        kind: impossibleKind,
        reason: impossibleReason ?? 'The requested constraint combination may be impossible or under-evidenced.',
        askUserForHelp: true,
      }
      : { kind: 'none', askUserForHelp: false },
    clarificationTriggers: [
      'required constraint cannot be evaluated from available tool evidence',
      'required constraints conflict or appear impossible',
      'bounded recovery cannot find enough source-backed evidence',
    ],
    successSemantics: requestedCount !== undefined || impossibleKind
      ? 'allow-partial-with-acknowledgement'
      : 'all-required',
    legacyCriteria: [],
  };
}

function pageChromeLinks() {
  return forbiddenLabels.slice(0, 12).map((label) => ({
    text: label,
    url: `https://fixtures.agent-browser.test/chrome/${slug(label)}`,
  }));
}

function fixtureTextFor(domain) {
  return [
    ...forbiddenLabels.slice(0, 8),
    ...domain.entities.map(([name, , locationEvidence]) => (
      `${name} is a ${domain.subject} with source-backed location evidence in ${locationEvidence}.`
    )),
  ].join('. ');
}

function fixturesFor(domain, goal, overrides = {}) {
  const expectedQuery = queryFor(domain, goal);
  const listingUrl = `https://fixtures.agent-browser.test/${domain.id}/${goal.id}/listing`;
  const fixture = {
    memoryResult: memoryFixture(),
    searchResults: {
      [expectedQuery]: {
        status: 'found',
        query: expectedQuery,
        results: [{
          title: `${goal.prompt} ${domain.subject} near ${LOCATION} - Source Directory`,
          url: listingUrl,
          snippet: `Source listing for ${domain.subject} near ${LOCATION}. Read the page to validate entity names and reject page chrome.`,
        }],
      },
      '*': {
        status: 'found',
        query: '*',
        results: [{
          title: `${goal.prompt} ${domain.subject} near ${LOCATION} - Source Directory`,
          url: listingUrl,
          snippet: `Source listing for ${domain.subject} near ${LOCATION}. Read the page to validate entity names and reject page chrome.`,
        }],
      },
    },
    pageResults: {
      [listingUrl]: {
        status: 'read',
        url: listingUrl,
        title: `${domain.subject} near ${LOCATION}`,
        text: fixtureTextFor(domain),
        links: [
          ...pageChromeLinks(),
          ...domain.entities.map(([name, url]) => ({ text: name, url })),
        ],
        jsonLd: [],
        entities: [
          ...forbiddenLabels.slice(0, 12).map((name) => ({
            name,
            url: `https://fixtures.agent-browser.test/chrome/${slug(name)}`,
            evidence: 'page navigation or content bucket link',
          })),
          ...domain.entities.map(([name, url, locationEvidence]) => ({
            name,
            url,
            evidence: `${name} is a ${domain.subject} with source-backed location evidence in ${locationEvidence}.`,
          })),
        ],
      },
    },
  };
  return {
    ...fixture,
    ...overrides,
    searchResults: { ...fixture.searchResults, ...(overrides.searchResults ?? {}) },
    pageResults: { ...fixture.pageResults, ...(overrides.pageResults ?? {}) },
  };
}

function followUpExpectedQuery(domain, goal, variant) {
  const prefix = variant.queryPrefix ?? queryPrefixForContextGoal(goal);
  return `${prefix} ${domain.subject} ${LOCATION_QUERY}`.replace(/\s+/g, ' ').trim();
}

function fixturesForFollowUp(domain, goal, variant) {
  const base = fixturesFor(domain, goal);
  const expectedQuery = followUpExpectedQuery(domain, goal, variant);
  const baseQuery = queryFor(domain, goal);
  const baseResult = base.searchResults[baseQuery] ?? base.searchResults['*'];
  return {
    ...base,
    searchResults: {
      ...base.searchResults,
      [expectedQuery]: {
        ...baseResult,
        query: expectedQuery,
      },
    },
  };
}

function followUpShortfallFixtures() {
  const domain = domains.find((candidate) => candidate.id === 'bars');
  const goal = rankingGoals.find((candidate) => candidate.id === 'closest');
  const expectedQuery = followUpExpectedQuery(domain, goal, followUpVariants[0]);
  const onlyCandidate = domain.entities[0];
  const onlyResult = {
    status: 'found',
    query: expectedQuery,
    results: [{
      title: `${onlyCandidate[0]} - Official Site`,
      url: onlyCandidate[1],
      snippet: `${onlyCandidate[0]} is a bar in ${onlyCandidate[2]}.`,
    }],
  };
  const discoveryQuery = `${domain.subject} names near ${LOCATION_QUERY}`;
  return {
    memoryResult: memoryFixture(),
    searchResults: {
      [expectedQuery]: onlyResult,
      [discoveryQuery]: {
        ...onlyResult,
        query: discoveryQuery,
      },
      [`"${onlyCandidate[0]}" ${LOCATION_QUERY} ${domain.subject} official reviews`]: {
        ...onlyResult,
        query: `"${onlyCandidate[0]}" ${LOCATION_QUERY} ${domain.subject} official reviews`,
      },
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'The deterministic shortfall fixture only has one additional accepted bar.',
      },
    },
    pageResults: {},
  };
}

function followUpMessages(domain, goal, variant, prior) {
  const initialRequest = `what are the ${goal.prompt} ${domain.subject} near me?`;
  const contextQuery = queryFor(domain, goal);
  const contextContract = validationContractFor({
    taskGoal: initialRequest,
    subject: domain.subject,
    location: LOCATION,
    requestedCount: 1,
  });
  const context = {
    taskText: initialRequest,
    resolvedTaskText: `${queryPrefixForContextGoal(goal)} ${domain.subject} near ${LOCATION_QUERY}`,
    subject: domain.subject,
    answerSubject: domain.plural,
    rankingGoal: contextRankingGoal(goal),
    location: LOCATION,
    acceptedCandidates: [{ name: prior[0], url: prior[1] }],
    rejectedLabels: forbiddenLabels.slice(0, 3),
    sourceQueries: [contextQuery],
    requestedCount: 1,
    validationContract: contextContract,
    timestamp: 1,
  };
  return [
    { role: 'user', content: initialRequest },
    {
      role: 'assistant',
      content: [
        `Here are ${domain.plural} near ${LOCATION_QUERY}:`,
        '',
        `1. [${prior[0]}](${prior[1]}) - Why: Source-backed ${domain.subject} result with location evidence in ${prior[2]}.`,
      ].join('\n'),
    },
    { role: 'system', content: `${SEARCH_TURN_CONTEXT_MARKER}\n${JSON.stringify(context)}` },
    { role: 'user', content: variant.text(prior) },
  ];
}

function subjectSwitchMessages({ fromDomain, fromGoal, toText, prior }) {
  const initialRequest = `what are the ${fromGoal.prompt} ${fromDomain.subject} near me?`;
  const contextQuery = queryFor(fromDomain, fromGoal);
  const contextContract = validationContractFor({
    taskGoal: initialRequest,
    subject: fromDomain.subject,
    location: LOCATION,
    requestedCount: 1,
  });
  const context = {
    taskText: initialRequest,
    resolvedTaskText: `${queryPrefixForContextGoal(fromGoal)} ${fromDomain.subject} near ${LOCATION_QUERY}`,
    subject: fromDomain.subject,
    answerSubject: fromDomain.plural,
    rankingGoal: contextRankingGoal(fromGoal),
    location: LOCATION,
    acceptedCandidates: [{ name: prior[0], url: prior[1] }],
    rejectedLabels: forbiddenLabels.slice(0, 6),
    sourceQueries: [contextQuery],
    requestedCount: 1,
    validationContract: contextContract,
    timestamp: 1,
  };
  return [
    { role: 'user', content: initialRequest },
    {
      role: 'assistant',
      content: [
        `Here are ${fromDomain.plural} near ${LOCATION_QUERY}:`,
        '',
        `1. [${prior[0]}](${prior[1]}) - Why: Source-backed ${fromDomain.subject} result with location evidence in ${prior[2]}.`,
      ].join('\n'),
    },
    { role: 'system', content: `${SEARCH_TURN_CONTEXT_MARKER}\n${JSON.stringify(context)}` },
    { role: 'user', content: toText },
  ];
}

function expectedOutputForFollowUp(domain, goal, variant, prior, overrides = {}) {
  const expectedQuery = followUpExpectedQuery(domain, goal, variant);
  return expectedOutputFor(domain, goal, {
    expectedQuery,
    expectedResult: 'follow-up-context-aware-entities',
    requestedCount: variant.requestedCount,
    minimumAcceptedEntities: variant.requestedCount,
    excludedCandidates: [prior[0]],
    messages: followUpMessages(domain, goal, variant, prior),
    fixtures: fixturesForFollowUp(domain, goal, variant),
    ...overrides,
  });
}

function movieTheaterChromeOnlyFixtures() {
  const domain = domains[0];
  const goal = rankingGoals[0];
  const expectedQuery = queryFor(domain, goal);
  return {
    memoryResult: memoryFixture(),
    searchResults: {
      [expectedQuery]: {
        status: 'found',
        query: expectedQuery,
        results: [
          {
            title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
            url: 'https://fixtures.agent-browser.test/movie-theaters/chrome-only-fandango',
            snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
          },
          {
            title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
            url: 'https://fixtures.agent-browser.test/movie-theaters/chrome-only-moviefone',
            snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
          },
        ],
      },
      'movie theaters names near Arlington Heights IL': {
        status: 'empty',
        query: 'movie theaters names near Arlington Heights IL',
        results: [],
        reason: 'Recorded bad-only fixture has no recoverable entity evidence.',
      },
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'Recorded bad-only fixture has no fallback entity evidence.',
      },
    },
    pageResults: {
      'https://fixtures.agent-browser.test/movie-theaters/chrome-only-fandango': {
        status: 'read',
        url: 'https://fixtures.agent-browser.test/movie-theaters/chrome-only-fandango',
        title: 'Movie Theaters near Arlington Heights',
        text: [
          'Skip to Main Content Go Movies Theaters FanStore At Home Movie News.',
          'At Home appears in the header navigation for movie theaters near Arlington Heights, IL.',
          'Movie Charts appears in a content bucket for movie theaters near Arlington Heights, IL.',
          'Movie News appears in a content bucket for movie theaters near Arlington Heights, IL.',
          'Fandango Ticketing Theaters My appears in the Fandango ticketing header for movie theaters near Arlington Heights, IL.',
          'Featured Movie Animal Farm appears in the featured movie content area for Arlington Heights showtimes.',
          'Movie Showimes is a misspelled showtimes heading on a movie theater listing page near Arlington Heights, IL.',
          'IL 60004 Update Zipcode Monday is a schedule control on the showtimes page.',
        ].join(' '),
        links: [
          { text: 'At Home', url: 'https://www.fandango.com/watch-at-home' },
          { text: 'Movie Charts', url: 'https://www.fandango.com/movie-charts' },
          { text: 'Movie News', url: 'https://www.fandango.com/movie-news' },
          { text: 'Fandango Ticketing Theaters My', url: 'https://www.fandango.com/arlington-heights_il_movietimes' },
          { text: 'Featured Movie Animal Farm', url: 'https://www.fandango.com/movie-news/animal-farm' },
          { text: 'Movie Showimes', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/' },
          { text: 'IL 60004 Update Zipcode Monday', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/' },
        ],
        jsonLd: [],
        entities: [
          { name: 'At Home', url: 'https://www.fandango.com/watch-at-home', evidence: 'At Home appears in the header navigation for movie theaters near Arlington Heights, IL.' },
          { name: 'Movie Charts', url: 'https://www.fandango.com/movie-charts', evidence: 'Movie Charts appears in a content bucket for movie theaters near Arlington Heights, IL.' },
          { name: 'Movie News', url: 'https://www.fandango.com/movie-news', evidence: 'Movie News appears in a content bucket for movie theaters near Arlington Heights, IL.' },
          { name: 'Fandango Ticketing Theaters My', url: 'https://www.fandango.com/arlington-heights_il_movietimes', evidence: 'Fandango Ticketing Theaters My appears in the Fandango ticketing header for movie theaters near Arlington Heights, IL.' },
          { name: 'Featured Movie Animal Farm', url: 'https://www.fandango.com/movie-news/animal-farm', evidence: 'Featured Movie Animal Farm appears in the featured movie content area for Arlington Heights showtimes.' },
          { name: 'Movie Showimes', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/', evidence: 'Movie Showimes is a misspelled showtimes heading on a movie theater listing page near Arlington Heights, IL.' },
          { name: 'IL 60004 Update Zipcode Monday', url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/', evidence: 'IL 60004 Update Zipcode Monday is a schedule control on the showtimes page.' },
        ],
      },
      'https://fixtures.agent-browser.test/movie-theaters/chrome-only-moviefone': {
        status: 'read',
        url: 'https://fixtures.agent-browser.test/movie-theaters/chrome-only-moviefone',
        title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
        text: [
          'Skip to Main Content Go Movies Theaters FanStore At Home Movie News Sign In/Join FanClub.',
          'Moviefone TV is displayed in the global navigation for movie theaters near Arlington Heights, IL.',
          'Sign In/Join appears in the account menu for movie theaters near Arlington Heights, IL.',
          'FanClub appears in the community navigation for movie theaters near Arlington Heights, IL.',
        ].join(' '),
        links: [
          { text: 'Moviefone TV', url: 'https://www.moviefone.com/tv/' },
          { text: 'Sign In/Join', url: 'https://www.moviefone.com/login/' },
          { text: 'FanClub', url: 'https://www.moviefone.com/fanclub/' },
        ],
        jsonLd: [],
        entities: [
          { name: 'Moviefone TV', url: 'https://www.moviefone.com/tv/', evidence: 'Moviefone TV is displayed in the global navigation for movie theaters near Arlington Heights, IL.' },
          { name: 'Sign In/Join', url: 'https://www.moviefone.com/login/', evidence: 'Sign In/Join appears in the account menu for movie theaters near Arlington Heights, IL.' },
          { name: 'FanClub', url: 'https://www.moviefone.com/fanclub/', evidence: 'FanClub appears in the community navigation for movie theaters near Arlington Heights, IL.' },
        ],
      },
    },
  };
}

function coordinateTheaterDirectoryFixtures() {
  const theaterDomain = { ...domains[0], subject: 'theaters', plural: 'theaters' };
  const expectedQuery = `nearby ${theaterDomain.subject} ${LOCATION_QUERY}`;
  const directoryUrl = 'https://fixtures.agent-browser.test/theaters/coordinate-directory/fandango';
  const recoveryQuery = `${theaterDomain.subject} names near ${LOCATION_QUERY}`;
  const directoryLabels = [
    'Cities Movie Times',
    'States Movie Times',
    'Zip Codes Movie Times',
  ];
  return {
    memoryResult: { status: 'empty', query: 'location', memories: [] },
    browserLocationResult: {
      status: 'available',
      latitude: 42.11713258868569,
      longitude: -87.9912774939386,
      accuracy: 24,
    },
    searchResults: {
      'city state for coordinates 42.12 -87.99': {
        status: 'found',
        query: 'city state for coordinates 42.12 -87.99',
        results: [{
          title: '42.12, -87.99 - Arlington Heights, Illinois',
          url: 'https://fixtures.agent-browser.test/geocode/arlington-heights',
          snippet: 'Coordinates 42.12, -87.99 are in Arlington Heights, Illinois, United States.',
        }],
      },
      [expectedQuery]: {
        status: 'found',
        query: expectedQuery,
        results: [{
          title: 'Movie Times and Movie Theaters in Arlington Heights, IL - Fandango',
          url: directoryUrl,
          snippet: 'Find movie times and movie theaters near Arlington Heights, IL.',
        }],
      },
      [recoveryQuery]: {
        status: 'found',
        query: recoveryQuery,
        results: domains[0].entities.map(([name, url, locationEvidence]) => ({
          title: `${name} - source-backed theater`,
          url,
          snippet: `${name} is a theater with location evidence in ${locationEvidence}.`,
        })),
      },
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'The coordinate theater regression requires geocoding, directory-label rejection, and targeted named-theater recovery.',
      },
    },
    pageResults: {
      [directoryUrl]: {
        status: 'read',
        url: directoryUrl,
        title: 'Movie theaters near Arlington Heights, IL',
        text: [
          'Movie Times by Cities',
          'Cities Movie Times',
          'Movie Times by States',
          'States Movie Times',
          'Movie Times by Zip Codes',
          'Zip Codes Movie Times',
        ].join(' '),
        links: directoryLabels.map((text) => ({
          text,
          url: `https://fixtures.agent-browser.test/theaters/coordinate-directory/${slug(text)}`,
        })),
        jsonLd: [],
        entities: directoryLabels.map((name) => ({
          name,
          url: `https://fixtures.agent-browser.test/theaters/coordinate-directory/${slug(name)}`,
          evidence: `${name} is a geography/movie-times directory label, not an individual theater.`,
        })),
      },
    },
  };
}

function barsAggregateRecoveryFixtures() {
  const domain = domains.find((candidate) => candidate.id === 'bars');
  const goal = rankingGoals.find((candidate) => candidate.id === 'closest');
  const expectedQuery = queryFor(domain, goal);
  const aggregateResults = [
    {
      title: 'Yelp: Best Bars in Arlington Heights, IL',
      url: 'https://fixtures.agent-browser.test/bars/aggregate/yelp',
      snippet: 'Best Bars in Arlington Heights, IL - directory and review search results.',
    },
    {
      title: "Chicago Bound: Arlington Heights' Best Bars",
      url: 'https://fixtures.agent-browser.test/bars/aggregate/chicago-bound',
      snippet: 'Guide to Arlington Heights bars with editorial list snippets.',
    },
    {
      title: 'Yellow Pages: Bars in Arlington Heights',
      url: 'https://fixtures.agent-browser.test/bars/aggregate/yellow-pages',
      snippet: 'Find bars in Arlington Heights, IL on Yellow Pages.',
    },
    {
      title: 'Restaurantji: Best Bars near Arlington Heights',
      url: 'https://fixtures.agent-browser.test/bars/aggregate/restaurantji',
      snippet: 'Restaurantji page for best bars near Arlington Heights.',
    },
    {
      title: 'Restaurant Guru: Top 7 pubs & bars',
      url: 'https://fixtures.agent-browser.test/bars/aggregate/restaurant-guru',
      snippet: 'Restaurant Guru aggregate ranking of pubs and bars.',
    },
  ];
  return {
    memoryResult: memoryFixture(),
    searchResults: {
      [expectedQuery]: {
        status: 'found',
        query: expectedQuery,
        results: aggregateResults,
      },
      'bars names near Arlington Heights IL': {
        status: 'found',
        query: 'bars names near Arlington Heights IL',
        results: domain.entities.map(([name, url, locationEvidence]) => ({
          title: `${name} - source-backed bar`,
          url,
          snippet: `${name} is a bar with location evidence in ${locationEvidence}.`,
        })),
      },
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'No unmatched fixture should be needed for the aggregate-bar recovery case.',
      },
    },
    pageResults: Object.fromEntries(aggregateResults.map((result) => [result.url, {
      status: 'read',
      url: result.url,
      title: result.title,
      text: [
        result.title,
        'This page is an aggregate source page for bars near Arlington Heights, IL.',
        'It contains directory headers, source names, advertising blocks, and navigation labels but no validated individual place rows in this recorded failure.',
      ].join(' '),
      links: [
        { text: result.title, url: result.url },
        { text: 'Best Bars', url: `${result.url}/best-bars` },
        { text: 'Restaurants', url: `${result.url}/restaurants` },
        { text: 'Reviews', url: `${result.url}/reviews` },
      ],
      jsonLd: [],
      entities: [
        { name: result.title, url: result.url, evidence: 'aggregate source title, not an individual bar entity' },
        { name: 'Best Bars', url: `${result.url}/best-bars`, evidence: 'directory category heading' },
        { name: 'Restaurants', url: `${result.url}/restaurants`, evidence: 'site navigation label' },
        { name: 'Reviews', url: `${result.url}/reviews`, evidence: 'site navigation label' },
      ],
    }])),
  };
}

function barsArticleChromeRecoveryFixtures() {
  const domain = domains.find((candidate) => candidate.id === 'bars');
  const expectedQuery = `bars ${LOCATION_QUERY}`;
  const aggregateUrl = 'https://fixtures.agent-browser.test/bars/article/chicago-bound';
  const yelpUrl = 'https://fixtures.agent-browser.test/bars/article/yelp';
  const recoveryQuery = `bars names near ${LOCATION_QUERY}`;
  const recoveryResults = domain.entities.map(([name, url, locationEvidence]) => ({
    title: `${name} - source-backed bar`,
    url,
    snippet: `${name} is a bar with location evidence in ${locationEvidence}.`,
  }));
  return {
    memoryResult: memoryFixture(),
    searchResults: {
      [expectedQuery]: {
        status: 'found',
        query: expectedQuery,
        results: [
          {
            title: "Chicago Bound: Arlington Heights' Best Bars Spots [2026 Guide]",
            url: aggregateUrl,
            snippet: 'Whether you are in the mood for a cozy corner to sip a craft cocktail or a lively spot to catch the game with friends, Arlington Heights has something for everyone.',
          },
          {
            title: 'Yelp: Best Bars in Arlington Heights, IL',
            url: yelpUrl,
            snippet: 'Directory search page for bars near Arlington Heights, IL.',
          },
        ],
      },
      [recoveryQuery]: {
        status: 'found',
        query: recoveryQuery,
        results: recoveryResults,
      },
      ...Object.fromEntries(domain.entities.map(([name, url, locationEvidence]) => [
        `"${name}" ${LOCATION_QUERY} ${domain.subject} official reviews`,
        {
          status: 'found',
          query: `"${name}" ${LOCATION_QUERY} ${domain.subject} official reviews`,
          results: [{
            title: `${name} - Official source`,
            url,
            snippet: `${name} is a bar with location evidence in ${locationEvidence}.`,
          }],
        },
      ])),
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'The article-chrome regression fixture requires recovery from aggregate pages to named bar evidence.',
      },
    },
    pageResults: {
      [aggregateUrl]: {
        status: 'read',
        url: aggregateUrl,
        title: "Arlington Heights' Best Bars Spots [2026 Guide]",
        text: [
          'Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode.',
          '{"@context":"https://schema.org","@type":"Article","headline":"Arlington Heights\' Best Bars Spots [2026 Guide]","description":"Whether you are in the mood for a cozy corner to sip a craft cocktail or a lively spot to catch the game with friends, Arlington Heights has something for everyone.","author":{"@type":"Person","name":"Chicago Bound"}}',
          "Bars Arlington Heights' Best Bars Spots [2026 Guide] A Alex Irvin Published: 2023-05-25 Updated: 2026-03-16.",
        ].join(' '),
        links: [
          { text: 'Support Enable', url: `${aggregateUrl}#support` },
          { text: 'Join Now Enable', url: `${aggregateUrl}#join` },
          { text: 'Chicago Bound', url: 'https://fixtures.agent-browser.test/bars/article/publisher-home' },
          { text: 'Shop Categories', url: `${aggregateUrl}#shop` },
          { text: 'About Us', url: `${aggregateUrl}#about` },
        ],
        jsonLd: [{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: "Arlington Heights' Best Bars Spots [2026 Guide]",
          description: 'Whether you are in the mood for a cozy corner to sip a craft cocktail or a lively spot to catch the game with friends, Arlington Heights has something for everyone.',
          image: 'https://fixtures.agent-browser.test/bars/article.webp',
          datePublished: '2026-03-16T00:00:00.000Z',
          author: { '@type': 'Person', name: 'Chicago Bound', url: 'https://fixtures.agent-browser.test/bars/article/publisher-home' },
        }],
        entities: [
          { name: 'Support Enable', url: `${aggregateUrl}#support`, evidence: 'site support/action navigation label in an article header' },
          { name: 'Join Now Enable', url: `${aggregateUrl}#join`, evidence: 'account/action navigation label in an article header' },
          { name: 'Chicago Bound', url: 'https://fixtures.agent-browser.test/bars/article/publisher-home', evidence: 'Article author and publisher metadata, not an individual bar' },
          { name: "Arlington Heights' Best Bars Spots [2026 Guide]", url: aggregateUrl, evidence: 'Article headline and broad page title, not an individual bar' },
        ],
      },
      [yelpUrl]: {
        status: 'read',
        url: yelpUrl,
        title: 'Yelp: Best Bars in Arlington Heights, IL',
        text: 'Yelp Best Bars in Arlington Heights, IL. Sign In. Search. Write a Review. This aggregate page has no validated individual place rows in the regression fixture.',
        links: [
          { text: 'Yelp: Best Bars in Arlington Heights, IL', url: yelpUrl },
          { text: 'Sign In', url: `${yelpUrl}/login` },
          { text: 'Write a Review', url: `${yelpUrl}/write-review` },
        ],
        jsonLd: [],
        entities: [
          { name: 'Yelp: Best Bars in Arlington Heights, IL', url: yelpUrl, evidence: 'aggregate source title, not an individual bar entity' },
          { name: 'Sign In', url: `${yelpUrl}/login`, evidence: 'account action link' },
          { name: 'Write a Review', url: `${yelpUrl}/write-review`, evidence: 'site action link' },
        ],
      },
    },
  };
}

function arbitraryPrefixFixtures() {
  const expectedQuery = 'shops the Vatican starts with A';
  const alternateQuery = 'shops Vatican starts with A';
  const listingUrl = 'https://fixtures.agent-browser.test/arbitrary/vatican-shops-prefix-a';
  const result = {
    status: 'found',
    query: expectedQuery,
    results: [{
      title: 'Shops in the Vatican starting with A',
      url: listingUrl,
      snippet: 'Alpha Gifts is a shop in the Vatican. Basilica Books is a shop in the Vatican but does not start with A.',
    }],
  };
  return {
    memoryResult: { status: 'empty', query: 'location', memories: [] },
    searchResults: {
      [expectedQuery]: result,
      [alternateQuery]: { ...result, query: alternateQuery },
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'The arbitrary prefix fixture only responds to the compiled constraint query.',
      },
    },
    pageResults: {
      [listingUrl]: {
        status: 'read',
        url: listingUrl,
        title: 'Vatican shops beginning with A',
        text: 'Alpha Gifts is a shop in the Vatican with verified source evidence. Basilica Books is a shop in the Vatican but fails the requested A-prefix constraint.',
        links: [
          { text: 'Alpha Gifts', url: 'https://fixtures.agent-browser.test/alpha-gifts' },
          { text: 'Basilica Books', url: 'https://fixtures.agent-browser.test/basilica-books' },
        ],
        jsonLd: [],
        entities: [
          {
            name: 'Alpha Gifts',
            url: 'https://fixtures.agent-browser.test/alpha-gifts',
            evidence: 'Alpha Gifts is a shop in the Vatican with verified source evidence.',
          },
          {
            name: 'Basilica Books',
            url: 'https://fixtures.agent-browser.test/basilica-books',
            evidence: 'Basilica Books is a shop in the Vatican but fails the requested A-prefix constraint.',
          },
        ],
      },
    },
  };
}

function arbitraryImpossibleFixtures() {
  const expectedQuery = 'websites middle earth rhymes with cat';
  const listingUrl = 'https://fixtures.agent-browser.test/arbitrary/middle-earth-rhyme-cat';
  return {
    memoryResult: { status: 'empty', query: 'location', memories: [] },
    searchResults: {
      [expectedQuery]: {
        status: 'found',
        query: expectedQuery,
        results: [{
          title: 'Middle Earth websites that rhyme with cat',
          url: listingUrl,
          snippet: 'A constraint stress fixture with no source-backed real websites located in Middle Earth and rhyming with cat.',
        }],
      },
      '*': {
        status: 'empty',
        query: '*',
        results: [],
        reason: 'No fallback evidence exists for the impossible arbitrary-constraint fixture.',
      },
    },
    pageResults: {
      [listingUrl]: {
        status: 'read',
        url: listingUrl,
        title: 'No verifiable Middle Earth websites',
        text: 'This fixture intentionally contains no accepted website entity located in Middle Earth whose name rhymes with cat.',
        links: [
          { text: 'Map', url: 'https://fixtures.agent-browser.test/arbitrary/map' },
          { text: 'Cat', url: 'https://fixtures.agent-browser.test/arbitrary/cat' },
          { text: 'Middle Earth Directory', url: 'https://fixtures.agent-browser.test/arbitrary/directory' },
        ],
        jsonLd: [],
        entities: [
          { name: 'Map', url: 'https://fixtures.agent-browser.test/arbitrary/map', evidence: 'generic navigation label' },
          { name: 'Cat', url: 'https://fixtures.agent-browser.test/arbitrary/cat', evidence: 'content keyword, not a website entity located in Middle Earth' },
          { name: 'Middle Earth Directory', url: 'https://fixtures.agent-browser.test/arbitrary/directory', evidence: 'aggregate source label, not an entity satisfying the rhyme/count constraints' },
        ],
      },
    },
  };
}

function answerFor(domain, goal) {
  return [
    `Here are ${domain.plural} near ${LOCATION}:`,
    '',
    ...domain.entities.map(([name, url, locationEvidence], index) => (
      `${index + 1}. [${name}](${url}) - Why: Source-backed ${domain.subject} result with location evidence in ${locationEvidence}.`
    )),
  ].join('\n');
}

function expectedOutputFor(domain, goal, overrides = {}) {
  const taskGoal = overrides.taskGoal
    ?? overrides.messages?.at?.(-1)?.content
    ?? `what are the ${goal.prompt} ${domain.subject} near me?`;
  const validationContract = overrides.validationContract ?? validationContractFor({
    taskGoal,
    subject: domain.subject,
    location: LOCATION,
    requestedCount: overrides.requestedCount,
    excludedCandidates: overrides.excludedCandidates ?? [],
  });
  return JSON.stringify({
    expectedQuery: queryFor(domain, goal),
    expectedEntities: domain.entities.map(([name]) => name),
    expectedEntityLinks: Object.fromEntries(domain.entities.map(([name, url]) => [name, url])),
    expectedLocations: [...new Set(domain.entities.map(([, , location]) => location))],
    forbiddenLabels,
    subject: domain.subject,
    rankingGoal: goal.id,
    location: LOCATION,
    fixtures: fixturesFor(domain, goal),
    validationContract,
    ...overrides,
  });
}

function liveExpectedOutputFor(domain, goal) {
  const taskGoal = `what are the ${goal.prompt} ${domain.subject} near me?`;
  return JSON.stringify({
    semanticOnly: true,
    expectedQuery: queryFor(domain, goal),
    minEntities: 1,
    subject: domain.subject,
    rankingGoal: goal.id,
    location: LOCATION,
    forbiddenLabels,
    expectedResult: 'semantic-entities-or-insufficient-evidence',
    validationContract: validationContractFor({
      taskGoal,
      subject: domain.subject,
      location: LOCATION,
      requestedCount: 1,
    }),
  });
}

export function buildSearchEvalCases() {
  const cases = [];
  for (const domain of domains) {
    for (const goal of rankingGoals) {
      cases.push({
        id: `${domain.id}-${goal.id}`,
        criteria: [
          `Answer the current request for ${goal.prompt} ${domain.subject} near ${LOCATION}.`,
          'The answer must list actual named entities of the requested subject.',
          'Each rendered entity must have a source-backed link and location/proximity evidence.',
          'Page chrome, navigation labels, account links, and content buckets must be rejected.',
        ].join(' '),
        input: `what are the ${goal.prompt} ${domain.subject} near me?`,
        expected_output: expectedOutputFor(domain, goal),
        metadata: {
          domain: domain.id,
          subject: domain.subject,
          rankingGoal: goal.id,
          location: LOCATION,
          expectedEntities: domain.entities.map(([name]) => name),
          forbiddenLabels,
        },
      });
    }
  }

  cases.unshift({
    id: 'negative-movie-theaters-page-chrome-only',
    criteria: [
      'This is the live bad-only regression case. The workflow must reject page chrome and return insufficient evidence instead of publishing entity-looking chrome labels.',
      'The verifier must block response-ready because there are zero accepted structured movie theater candidates.',
    ].join(' '),
    input: "what're the best movie theaters near me?",
    expected_output: expectedOutputFor(domains[0], rankingGoals[0], {
      negative: true,
      expectedResult: 'insufficient-evidence-no-publish',
      fixtures: movieTheaterChromeOnlyFixtures(),
      badAnswer: [
        'Here are movie theaters near Arlington Heights, IL:',
        '',
        '1. [Moviefone TV](https://www.moviefone.com/tv/) - Why: Movie Showtimes Near Arlington Heights, IL | Moviefone',
        '2. [Sign In/Join](https://www.moviefone.com/login/) - Why: Skip to Main Content Go Movies Theaters FanStore At Home Movie News Sign In/Join.',
        '3. [FanClub](https://www.moviefone.com/fanclub/) - Why: Skip to Main Content Go Movies Theaters FanStore At Home Movie News Sign In/Join.',
      ].join('\n'),
      badLabels: [
        'Moviefone TV',
        'Sign In/Join',
        'FanClub',
        'At Home',
        'Movie Charts',
        'Movie News',
        'Fandango Ticketing Theaters My',
        'Featured Movie Animal Farm',
        'Movie Showimes',
        'IL 60004 Update Zipcode Monday',
      ],
    }),
    metadata: {
      domain: 'movie-theaters',
      subject: 'movie theaters',
      rankingGoal: 'best',
      location: LOCATION,
      negative: true,
      badOnly: true,
      badLabels: [
        'Moviefone TV',
        'Sign In/Join',
        'FanClub',
        'At Home',
        'Movie Charts',
        'Movie News',
        'Fandango Ticketing Theaters My',
        'Featured Movie Animal Farm',
        'Movie Showimes',
        'IL 60004 Update Zipcode Monday',
      ],
      expectedEntities: domains[0].entities.map(([name]) => name),
      forbiddenLabels,
    },
  }, {
    id: 'negative-theaters-browser-coordinate-directory-labels',
    criteria: [
      'This is the no-memory browser-coordinate regression case for "show me theaters near me".',
      'The workflow must read browser geolocation, normalize rounded coordinates 42.12 -87.99 to Arlington Heights, IL through web search, and never use raw latitude/longitude in local search queries or final answers.',
      'The workflow must reject Cities Movie Times, States Movie Times, Zip Codes Movie Times, and related movie-times geography directory labels before publishing.',
      'After rejecting directory labels, the workflow must recover with theaters names near Arlington Heights IL and publish actual named theater entities only.',
    ].join(' '),
    input: 'show me theaters near me',
    expected_output: expectedOutputFor(
      { ...domains[0], subject: 'theaters', plural: 'theaters' },
      rankingGoals.find((goal) => goal.id === 'near-me'),
      {
        taskGoal: 'show me theaters near me',
        negative: true,
        expectedResult: 'recovered',
        fixtures: coordinateTheaterDirectoryFixtures(),
        badAnswer: [
          'Here are theaters near 42.11713258868569,-87.9912774939386:',
          '',
          '1. [Cities Movie Times](https://www.cinemaclock.com/) - Why: Cities Movie Times appears in a source section for theaters near 42.11713258868569,-87.9912774939386.',
          '2. [States Movie Times](https://www.cinemark.com/) - Why: States Movie Times appears in a source section for theaters near 42.11713258868569,-87.9912774939386.',
          '3. [Zip Codes Movie Times](https://www.showtimes.com/movie-times/movies-by-zip-code/) - Why: Zip Codes Movie Times appears in a source section for theaters near 42.11713258868569,-87.9912774939386.',
        ].join('\n'),
        badLabels: [
          'Cities Movie Times',
          'States Movie Times',
          'Zip Codes Movie Times',
          'Movie Times by Cities',
          'Movie Times by States',
          'Movie Times by Zip Codes',
        ],
      },
    ),
    metadata: {
      domain: 'theaters',
      subject: 'theaters',
      rankingGoal: 'near-me',
      location: LOCATION,
      negative: true,
      noMemory: true,
      browserCoordinateLocation: true,
      expectedQuery: `nearby theaters ${LOCATION_QUERY}`,
      expectedNormalizationQuery: 'city state for coordinates 42.12 -87.99',
      recoveryQuery: `theaters names near ${LOCATION_QUERY}`,
      badLabels: [
        'Cities Movie Times',
        'States Movie Times',
        'Zip Codes Movie Times',
        'Movie Times by Cities',
        'Movie Times by States',
        'Movie Times by Zip Codes',
      ],
      expectedEntities: domains[0].entities.map(([name]) => name),
      forbiddenLabels,
    },
  }, {
    id: 'negative-movie-theaters-moviefone-page-chrome',
    criteria: [
      'This is a runtime regression case. The workflow must reject the reported bad answer and must not publish response-ready.',
      'The verifier must fail labels that are page chrome instead of actual movie theater names.',
    ].join(' '),
    input: "what're the best movie theaters near me?",
    expected_output: expectedOutputFor(domains[0], rankingGoals[0], {
      negative: true,
      expectedResult: 'recovered',
      fixtures: fixturesFor(domains[0], rankingGoals[0], {
        searchResults: {
          [queryFor(domains[0], rankingGoals[0])]: {
            status: 'found',
            query: queryFor(domains[0], rankingGoals[0]),
            results: [
              {
                title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                url: 'https://fixtures.agent-browser.test/movie-theaters/bad-fandango',
                snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
              },
              {
                title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                url: 'https://fixtures.agent-browser.test/movie-theaters/bad-moviefone',
                snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
              },
            ],
          },
          'movie theaters names near Arlington Heights IL': {
            status: 'found',
            query: 'movie theaters names near Arlington Heights IL',
            results: domains[0].entities.map(([name, url, locationEvidence]) => ({
              title: `${name} - source-backed movie theater`,
              url,
              snippet: `${name} is a movie theater with location evidence in ${locationEvidence}.`,
            })),
          },
        },
        pageResults: {
          'https://fixtures.agent-browser.test/movie-theaters/bad-fandango': {
            status: 'read',
            url: 'https://fixtures.agent-browser.test/movie-theaters/bad-fandango',
            title: 'Movie Theaters near Arlington Heights',
            text: 'At Home. Movie Charts. Movie News. Movies. Theaters. TV Shows. FanStore. Streaming. Coming Soon. Skip to Main Content.',
            links: [
              { text: 'At Home', url: 'https://www.fandango.com/watch-at-home' },
              { text: 'Movie Charts', url: 'https://www.fandango.com/movie-charts' },
              { text: 'Movie News', url: 'https://www.fandango.com/movie-news' },
              { text: 'Movies', url: 'https://www.fandango.com/movies' },
              { text: 'Theaters', url: 'https://www.fandango.com/theaters' },
              { text: 'TV Shows', url: 'https://www.fandango.com/tv' },
              { text: 'FanStore', url: 'https://www.fandango.com/fan-store' },
            ],
            jsonLd: [],
            entities: [
              { name: 'At Home', url: 'https://www.fandango.com/watch-at-home', evidence: 'page navigation link' },
              { name: 'Movie Charts', url: 'https://www.fandango.com/movie-charts', evidence: 'page content bucket link' },
              { name: 'Movie News', url: 'https://www.fandango.com/movie-news', evidence: 'page content bucket link' },
              { name: 'Movies', url: 'https://www.fandango.com/movies', evidence: 'page navigation link' },
              { name: 'Theaters', url: 'https://www.fandango.com/theaters', evidence: 'page navigation link' },
              { name: 'TV Shows', url: 'https://www.fandango.com/tv', evidence: 'page navigation link' },
              { name: 'FanStore', url: 'https://www.fandango.com/fan-store', evidence: 'page store section link' },
            ],
          },
          'https://fixtures.agent-browser.test/movie-theaters/bad-moviefone': {
            status: 'read',
            url: 'https://fixtures.agent-browser.test/movie-theaters/bad-moviefone',
            title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
            text: 'Moviefone TV. Sign In/Join. FanClub. Showtimes. Tickets.',
            links: [
              { text: 'Moviefone TV', url: 'https://www.moviefone.com/tv/' },
              { text: 'Sign In/Join', url: 'https://www.moviefone.com/login/' },
              { text: 'FanClub', url: 'https://www.moviefone.com/fanclub/' },
            ],
            jsonLd: [],
            entities: [
              { name: 'Moviefone TV', url: 'https://www.moviefone.com/tv/', evidence: 'page navigation link' },
              { name: 'Sign In/Join', url: 'https://www.moviefone.com/login/', evidence: 'account action link' },
              { name: 'FanClub', url: 'https://www.moviefone.com/fanclub/', evidence: 'site community section link' },
            ],
          },
        },
      }),
      badAnswer: [
        'Here are movie theaters near Arlington Heights, IL:',
        '',
        '1. [Moviefone TV](https://www.moviefone.com/tv/) - Why: Found on a showtimes source source page for Arlington Heights, IL. page link',
        '2. [Sign In/Join](https://www.moviefone.com/login/) - Why: Found on a showtimes source source page for Arlington Heights, IL. page link',
        '3. [FanClub](https://www.moviefone.com/fanclub/) - Why: Found on a showtimes source source page for Arlington Heights, IL. page link',
      ].join('\n'),
      badLabels: ['Moviefone TV', 'Sign In/Join', 'FanClub'],
    }),
    metadata: {
      domain: 'movie-theaters',
      subject: 'movie theaters',
      rankingGoal: 'best',
      location: LOCATION,
      negative: true,
      badLabels: ['Moviefone TV', 'Sign In/Join', 'FanClub'],
      expectedEntities: domains[0].entities.map(([name]) => name),
      forbiddenLabels,
    },
  }, {
    id: 'negative-follow-up-bars-show-me-3-more-only-one-result',
    criteria: [
      'This is a count-contract regression case for follow-up search.',
      'The previous answer already showed Sports Page Bar & Grill Arlington Heights.',
      'The user asks for three more bars, but the fixture can verify only one additional bar.',
      'The workflow must not publish a one-item answer as if it fully satisfied the request; if it can verify only one additional bar, it must render that verified bar and explicitly acknowledge the requested-count shortfall.',
    ].join(' '),
    input: 'show me 3 more',
    expected_output: expectedOutputForFollowUp(
      domains.find((domain) => domain.id === 'bars'),
      rankingGoals.find((goal) => goal.id === 'closest'),
      followUpVariants[0],
      priorEntities.bars,
      {
        expectedResult: 'insufficient-follow-up-count',
        fixtures: followUpShortfallFixtures(),
      },
    ),
    metadata: {
      followUp: true,
      negative: true,
      shortfall: true,
      domain: 'bars',
      subject: 'bars',
      rankingGoal: 'closest',
      location: LOCATION,
      priorEntity: priorEntities.bars[0],
      expectedQuery: followUpExpectedQuery(
        domains.find((domain) => domain.id === 'bars'),
        rankingGoals.find((goal) => goal.id === 'closest'),
        followUpVariants[0],
      ),
      requestedCount: 3,
      minimumAcceptedEntities: 3,
      excludedCandidates: [priorEntities.bars[0]],
      expectedEntities: domains.find((domain) => domain.id === 'bars').entities.map(([name]) => name),
      forbiddenLabels,
    },
  }, {
    id: 'negative-follow-up-bars-article-page-chrome',
    criteria: [
      'This is the latest runtime regression case for a subject switch follow-up.',
      'A prior movie-theater answer provides only compatible location context; the current request switches the requested subject to bars.',
      'The workflow must reject Article JSON-LD, publisher names, account/navigation labels, and broad article/listing titles as bar entities.',
      'The workflow must recover to individual bar/place names before publishing, or explicitly report insufficient evidence.',
    ].join(' '),
    input: 'what about bars?',
    expected_output: expectedOutputFor(domains.find((domain) => domain.id === 'bars'), rankingGoals.find((goal) => goal.id === 'closest'), {
      negative: true,
      expectedQuery: `bars ${LOCATION_QUERY}`,
      expectedResult: 'recovered',
      messages: subjectSwitchMessages({
        fromDomain: domains.find((domain) => domain.id === 'movie-theaters'),
        fromGoal: rankingGoals.find((goal) => goal.id === 'best'),
        toText: 'what about bars?',
        prior: domains.find((domain) => domain.id === 'movie-theaters').entities[0],
      }),
      fixtures: barsArticleChromeRecoveryFixtures(),
      badAnswer: [
        `Here are bars near ${LOCATION_QUERY}:`,
        '',
        '1. [Support Enable](https://fixtures.agent-browser.test/bars/article/chicago-bound#support) - Why: Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode {"@context":"https://schema.org","@type":"Article","headline":"Arlington Heights\' Best Bars Spots [2026 Guide]"}',
        '2. [Join Now Enable](https://fixtures.agent-browser.test/bars/article/chicago-bound#join) - Why: Chicago Bound Shop Categories About Us Support Enable dark mode Join Now Enable dark mode {"@context":"https://schema.org","@type":"Article"}',
        '3. [Chicago Bound](https://fixtures.agent-browser.test/bars/article/publisher-home) - Why: Article publisher metadata and page title for Arlington Heights bars.',
      ].join('\n'),
      badLabels: [
        'Support Enable',
        'Join Now Enable',
        'Chicago Bound',
        "Arlington Heights' Best Bars Spots [2026 Guide]",
        'Shop Categories',
        'About Us',
        'Enable dark mode',
        'Yelp: Best Bars in Arlington Heights, IL',
      ],
    }),
    metadata: {
      followUp: true,
      subjectSwitch: true,
      negative: true,
      domain: 'bars',
      subject: 'bars',
      previousSubject: 'movie theaters',
      rankingGoal: undefined,
      location: LOCATION,
      expectedQuery: `bars ${LOCATION_QUERY}`,
      badLabels: [
        'Support Enable',
        'Join Now Enable',
        'Chicago Bound',
        "Arlington Heights' Best Bars Spots [2026 Guide]",
        'Shop Categories',
        'About Us',
        'Enable dark mode',
        'Yelp: Best Bars in Arlington Heights, IL',
      ],
      expectedEntities: domains.find((domain) => domain.id === 'bars').entities.map(([name]) => name),
      forbiddenLabels,
    },
  }, {
    id: 'negative-bars-aggregate-source-pages',
    criteria: [
      'This is a runtime regression case for closest bars.',
      'The workflow must reject aggregate/list-page titles as requested entities and recover to individual bar/place names before publishing.',
      'The verifier must fail if Yelp, Yellow Pages, Restaurantji, Restaurant Guru, or other source/list titles are rendered as bars.',
    ].join(' '),
    input: 'what about closest bars?',
    expected_output: expectedOutputFor(domains.find((domain) => domain.id === 'bars'), rankingGoals.find((goal) => goal.id === 'closest'), {
      negative: true,
      expectedResult: 'recovered',
      fixtures: barsAggregateRecoveryFixtures(),
      badAnswer: [
        'Here are some of the closest bars in Arlington Heights, IL:',
        '',
        '- [Yelp: Best Bars in Arlington Heights, IL](https://fixtures.agent-browser.test/bars/aggregate/yelp)',
        "- [Chicago Bound: Arlington Heights' Best Bars](https://fixtures.agent-browser.test/bars/aggregate/chicago-bound)",
        '- [Yellow Pages: Bars in Arlington Heights](https://fixtures.agent-browser.test/bars/aggregate/yellow-pages)',
        '- [Restaurantji: Best Bars near Arlington Heights](https://fixtures.agent-browser.test/bars/aggregate/restaurantji)',
        '- [Restaurant Guru: Top 7 pubs & bars](https://fixtures.agent-browser.test/bars/aggregate/restaurant-guru)',
      ].join('\n'),
      badLabels: [
        'Yelp: Best Bars in Arlington Heights, IL',
        "Chicago Bound: Arlington Heights' Best Bars",
        'Yellow Pages: Bars in Arlington Heights',
        'Restaurantji: Best Bars near Arlington Heights',
        'Restaurant Guru: Top 7 pubs & bars',
      ],
    }),
    metadata: {
      domain: 'bars',
      subject: 'bars',
      rankingGoal: 'closest',
      location: LOCATION,
      negative: true,
      badLabels: [
        'Yelp: Best Bars in Arlington Heights, IL',
        "Chicago Bound: Arlington Heights' Best Bars",
        'Yellow Pages: Bars in Arlington Heights',
        'Restaurantji: Best Bars near Arlington Heights',
        'Restaurant Guru: Top 7 pubs & bars',
      ],
      expectedEntities: domains.find((domain) => domain.id === 'bars').entities.map(([name]) => name),
      forbiddenLabels,
    },
  });

  cases.push({
    id: 'arbitrary-vatican-shops-prefix-a',
    criteria: [
      'Compile arbitrary query constraints before tool planning.',
      'The answer must list shops in the Vatican whose names start with A.',
      'The answer must reject otherwise valid shops that fail the generated name-prefix constraint.',
    ].join(' '),
    input: 'provide shops in the Vatican that start with the letter "A"',
    expected_output: JSON.stringify({
      expectedQuery: 'shops the Vatican starts with A',
      expectedEntities: ['Alpha Gifts'],
      expectedEntityLinks: {
        'Alpha Gifts': 'https://fixtures.agent-browser.test/alpha-gifts',
      },
      expectedLocations: ['Vatican'],
      forbiddenLabels: ['Basilica Books', ...forbiddenLabels],
      subject: 'shops',
      rankingGoal: undefined,
      location: 'Vatican',
      fixtures: arbitraryPrefixFixtures(),
      validationContract: validationContractFor({
        taskGoal: 'provide shops in the Vatican that start with the letter "A"',
        subject: 'shops',
        location: 'Vatican',
        prefix: 'A',
      }),
    }),
    metadata: {
      arbitraryConstraints: true,
      domain: 'arbitrary-shops',
      subject: 'shops',
      location: 'Vatican',
      expectedEntities: ['Alpha Gifts'],
      forbiddenLabels: ['Basilica Books', ...forbiddenLabels],
      validationConstraintTypes: ['subject', 'location', 'name_prefix'],
    },
  }, {
    id: 'arbitrary-websites-middle-earth-rhyme-cat-insufficient',
    criteria: [
      'Compile arbitrary count, rhyme, type, and fictional-location constraints.',
      'The workflow must try bounded evidence gathering and then acknowledge the unmet constraints.',
      'It must not fabricate websites located in Middle Earth or silently drop the rhyme/count constraints.',
    ].join(' '),
    input: 'show 10 websites that rhyme with "cat" located in middle earth',
    expected_output: JSON.stringify({
      expectedQuery: 'websites middle earth rhymes with cat',
      expectedResult: 'insufficient-evidence-no-publish',
      expectedEntities: [],
      expectedLocations: ['middle earth'],
      forbiddenLabels,
      subject: 'websites',
      location: 'middle earth',
      requestedCount: 10,
      minimumAcceptedEntities: 10,
      fixtures: arbitraryImpossibleFixtures(),
      validationContract: validationContractFor({
        taskGoal: 'show 10 websites that rhyme with "cat" located in middle earth',
        subject: 'websites',
        location: 'middle earth',
        requestedCount: 10,
        rhyme: 'cat',
        impossibleKind: 'likely-impossible',
        impossibleReason: 'middle earth appears fictional or not directly verifiable by normal web/local search evidence.',
      }),
    }),
    metadata: {
      arbitraryConstraints: true,
      negative: true,
      domain: 'arbitrary-websites',
      subject: 'websites',
      location: 'middle earth',
      requestedCount: 10,
      minimumAcceptedEntities: 10,
      validationConstraintTypes: ['count', 'subject', 'location', 'rhyme'],
      forbiddenLabels,
    },
  });

  for (const domain of domains) {
    for (const [goalIndex, goal] of rankingGoals.entries()) {
      const variant = domain.id === 'bars' && goal.id === 'closest'
        ? followUpVariants[0]
        : followUpVariants[goalIndex % followUpVariants.length];
      const prior = priorEntities[domain.id];
      const expectedQuery = followUpExpectedQuery(domain, goal, variant);
      const exactBarsRegression = domain.id === 'bars' && goal.id === 'closest' && variant.id === 'show-me-3-more';
      cases.push({
        id: exactBarsRegression ? 'follow-up-bars-show-me-3-more' : `follow-up-${domain.id}-${goal.id}-${variant.id}`,
        criteria: [
          `Resolve the follow-up "${variant.text(prior)}" using prior context for ${goal.prompt} ${domain.subject} near ${LOCATION}.`,
          'The tool query must inherit subject and location from the prior structured search context.',
          'The literal follow-up phrase must not be used as the web search query.',
          'Previously accepted candidates must be excluded from the final answer unless explicitly requested again.',
          'The final answer must list actual additional requested entities, not aggregate pages or page chrome.',
          `The final answer should contain at least ${variant.requestedCount} additional accepted entities; if bounded evidence yields fewer, it must explicitly acknowledge the shortfall instead of presenting the partial list as complete success.`,
        ].join(' '),
        input: variant.text(prior),
        expected_output: expectedOutputForFollowUp(domain, goal, variant, prior),
        metadata: {
          followUp: true,
          domain: domain.id,
          subject: domain.subject,
          rankingGoal: goal.id,
          location: LOCATION,
          priorEntity: prior[0],
          expectedQuery,
          requestedCount: variant.requestedCount,
          minimumAcceptedEntities: variant.requestedCount,
          excludedCandidates: [prior[0]],
          expectedEntities: domain.entities.map(([name]) => name),
          forbiddenLabels,
        },
      });
    }
  }

  return cases.map((testCase, index) => ({
    ...testCase,
    id: testCase.id === 'movie-theaters-best' ? 'movie-theaters-arlington-heights' : testCase.id,
    metadata: {
      ...testCase.metadata,
      matrixIndex: index,
    },
  }));
}

export function buildSearchLiveEvalCases() {
  const cases = [];
  for (const domain of domains) {
    for (const goal of rankingGoals) {
      cases.push({
        id: `${domain.id}-${goal.id}`,
        criteria: [
          `Answer the current live request for ${goal.prompt} ${domain.subject} near ${LOCATION}.`,
          'The answer must list actual named entities of the requested subject when live evidence supports them.',
          'Each rendered entity must have a source-backed link and location/proximity evidence for nearby requests.',
          'If live provider evidence is insufficient, the answer must say so instead of rendering page chrome.',
        ].join(' '),
        input: `what are the ${goal.prompt} ${domain.subject} near me?`,
        expected_output: liveExpectedOutputFor(domain, goal),
        metadata: {
          live: true,
          semanticOnly: true,
          domain: domain.id,
          subject: domain.subject,
          rankingGoal: goal.id,
          location: LOCATION,
          forbiddenLabels,
        },
      });
    }
  }
  return cases.slice(0, 120).map((testCase, index) => ({
    ...testCase,
    id: testCase.id === 'movie-theaters-best' ? 'movie-theaters-arlington-heights' : testCase.id,
    metadata: {
      ...testCase.metadata,
      matrixIndex: index,
    },
  }));
}

export async function writeSearchEvalCases(outputPath = casesPath) {
  const cases = buildSearchEvalCases();
  const liveCases = buildSearchLiveEvalCases();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${cases.map((testCase) => JSON.stringify(testCase)).join('\n')}\n`);
  await writeFile(liveCasesPath, `${liveCases.map((testCase) => JSON.stringify(testCase)).join('\n')}\n`);
  return { outputPath, count: cases.length, liveOutputPath: liveCasesPath, liveCount: liveCases.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await writeSearchEvalCases();
  console.log(JSON.stringify(result, null, 2));
}
