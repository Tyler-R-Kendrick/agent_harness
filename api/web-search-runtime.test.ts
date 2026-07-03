import assert from 'node:assert/strict';
import test from 'node:test';

import { WebSearchBridge } from './web-search-runtime.ts';

test('WebSearchBridge drops DuckDuckGo HTML results that decode to non-http URLs', async () => {
  const fetchImpl = async () => new Response(`
    <a class="result__a" href="/l/?uddg=javascript%3Aalert(1)">Unsafe</a>
    <div class="result__snippet">Blocked snippet</div>
    <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fsafe">Safe Result</a>
    <div class="result__snippet">Allowed snippet</div>
  `, { status: 200 });

  const bridge = new WebSearchBridge(fetchImpl, 100);
  const result = await bridge.search({ query: 'agent harness', limit: 5 });

  assert.deepEqual(result, {
    status: 'found',
    query: 'agent harness',
    results: [{
      title: 'Safe Result',
      url: 'https://example.com/safe',
      snippet: 'Allowed snippet',
    }],
  });
});

test('WebSearchBridge drops Bing HTML results with non-http schemes', async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response('<html></html>', { status: 200 });
    }
    return new Response(`
      <li class="b_algo">
        <a href="javascript:alert(1)">Unsafe Result</a>
        <p>Blocked snippet</p>
      </li>
      <li class="b_algo">
        <a href="https://example.com/bing-safe">Safe Bing Result</a>
        <p>Allowed snippet</p>
      </li>
    `, { status: 200 });
  };

  const bridge = new WebSearchBridge(fetchImpl, 100);
  const result = await bridge.search({ query: 'safe bing', limit: 5 });

  assert.deepEqual(result, {
    status: 'found',
    query: 'safe bing',
    results: [{
      title: 'Safe Bing Result',
      url: 'https://example.com/bing-safe',
      snippet: 'Allowed snippet',
    }],
  });
});
