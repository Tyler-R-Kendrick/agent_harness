import type { SearchFact, SearchResult, SparqlJsonBindingValue, SparqlJsonResult } from '../types';

function bindingValue(value: SparqlJsonBindingValue | undefined): string | undefined {
  return typeof value?.value === 'string' && value.value.trim() ? value.value.trim() : undefined;
}

function qidFromWikidataUri(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/\/entity\/(Q[1-9][0-9]*)$/i);
  return match ? match[1].toUpperCase() : undefined;
}

function wikidataUrlForId(id: string): string {
  return `https://www.wikidata.org/wiki/${id}`;
}

export function normalizeWikidataEntityResults(result: SparqlJsonResult): SearchResult[] {
  return (result.results?.bindings ?? [])
    .map((binding): SearchResult | null => {
      const itemUrl = bindingValue(binding.item);
      const id = qidFromWikidataUri(itemUrl);
      const title = bindingValue(binding.itemLabel);
      if (!id || !title || title === id) return null;
      const description = bindingValue(binding.itemDescription);
      return {
        id,
        title,
        url: wikidataUrlForId(id),
        source: 'wikidata',
        sourceName: 'Wikidata',
        ...(description ? { description } : {}),
        score: 0.5,
        raw: binding,
      };
    })
    .filter((item): item is SearchResult => Boolean(item));
}

export function normalizeWikidataFactsResults({
  qid,
  result,
}: {
  qid: string;
  result: SparqlJsonResult;
}): SearchResult[] {
  const facts: SearchFact[] = (result.results?.bindings ?? [])
    .map((binding): SearchFact | null => {
      const label = bindingValue(binding.propertyLabel);
      const value = bindingValue(binding.valueLabel) ?? bindingValue(binding.value);
      if (!label || !value) return null;
      const url = qidFromWikidataUri(bindingValue(binding.value))
        ? wikidataUrlForId(qidFromWikidataUri(bindingValue(binding.value))!)
        : undefined;
      return { label, value, ...(url ? { url } : {}) };
    })
    .filter((item): item is SearchFact => Boolean(item));
  return [{
    id: qid,
    title: `Wikidata facts for ${qid}`,
    url: wikidataUrlForId(qid),
    source: 'wikidata',
    sourceName: 'Wikidata',
    description: facts.slice(0, 3).map((fact) => `${fact.label}: ${fact.value}`).join('; '),
    score: facts.length > 0 ? 0.8 : 0.35,
    facts,
    raw: result,
  }];
}
