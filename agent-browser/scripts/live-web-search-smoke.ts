import { createConfiguredWebSearchBridge } from '../server/searchMiddleware';

const DEFAULT_QUERIES = [
  'OpenAI Responses API tool calling docs',
  'NASA Mars Sample Return mission update',
];

const queries = process.argv.slice(2).map((query) => query.trim()).filter(Boolean);
const smokeQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;
const bridge = createConfiguredWebSearchBridge();

for (const query of smokeQueries) {
  const result = await bridge.search({ query, limit: 3 });
  if (result.status !== 'found' || result.results.length === 0) {
    throw new Error(`Live web search failed for "${query}": ${result.reason ?? result.status}`);
  }
  const top = result.results[0];
  console.log(`${query}: ${top.title} <${top.url}>`);
}
