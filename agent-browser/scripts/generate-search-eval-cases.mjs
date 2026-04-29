import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const casesPath = path.join(appRoot, 'evals/search-fulfillment/cases.jsonl');
const liveCasesPath = path.join(appRoot, 'evals/search-fulfillment/cases.live.jsonl');

const LOCATION = 'Arlington Heights, IL';

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
  'Tickets',
  'Reviews',
  'Menu',
  'Directions',
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function queryFor(domain, goal) {
  return `${goal.queryPrefix} ${domain.subject} Arlington Heights IL`;
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
    ...overrides,
  });
}

function liveExpectedOutputFor(domain, goal) {
  return JSON.stringify({
    semanticOnly: true,
    expectedQuery: queryFor(domain, goal),
    minEntities: 1,
    subject: domain.subject,
    rankingGoal: goal.id,
    location: LOCATION,
    forbiddenLabels,
    expectedResult: 'semantic-entities-or-insufficient-evidence',
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
  });

  return cases.slice(0, 120).map((testCase, index) => ({
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
