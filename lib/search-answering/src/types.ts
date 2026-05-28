export interface DirectSourceSearchIntent {
  currentTaskText: string;
  subject: string;
  externalSearchRequired: boolean;
  locationRequired: boolean;
  requestedCount?: number;
  rankingGoal?: string;
  validationConstraints?: SearchValidationConstraint[];
}

export interface SearchValidationConstraint {
  type: string;
}

export interface SourceSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface SourceSearchResult {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: SourceSearchResultItem[];
  reason?: string;
}

export interface SourceResultAnswerInput {
  subject: string;
  results: SourceSearchResultItem[];
  limit?: number;
  maxSnippetLength?: number;
}

export interface UnavailableSearchInput {
  answerSubject: string;
  location?: string;
  reason?: string;
}
