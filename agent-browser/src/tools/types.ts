import type { IFileSystem } from 'just-bash/browser';
import type { ChatMessage } from '../types';

export type CliHistoryEntry = {
  cmd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type TerminalCliResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string | null;
  outputTruncated: boolean;
};

export type AppWebSearchResult = {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  reason?: string;
};

export type AppWebPageResult = {
  status: 'read' | 'unavailable' | 'blocked';
  url: string;
  title?: string;
  text?: string;
  links: Array<{ text: string; url: string }>;
  jsonLd: unknown[];
  entities: Array<{ name: string; url?: string; evidence: string }>;
  observations?: Array<{
    kind: 'json-ld' | 'page-link' | 'heading' | 'text-span';
    label: string;
    url?: string;
    evidence: string;
    localContext?: string;
    sourceUrl: string;
  }>;
  reason?: string;
};

export type TerminalExecutorContext = {
  appendSharedMessages: (entries: ChatMessage[]) => void;
  getSessionBash: (sessionId: string) => {
    exec: (command: string) => Promise<{ stdout?: string; stderr: string; exitCode: number }>;
    cwd?: string;
    fs: {
      getAllPaths: IFileSystem['getAllPaths'];
      readFile?: IFileSystem['readFile'];
      writeFile?: IFileSystem['writeFile'];
      mkdir?: IFileSystem['mkdir'];
    };
  };
  notifyTerminalFsPathsChanged: (sessionId: string, paths: string[]) => void;
  sessionId: string;
  searchWeb?: (request: { query: string; limit: number }) => Promise<AppWebSearchResult>;
  readWebPage?: (request: { url: string }) => Promise<AppWebPageResult>;
  setBashHistoryBySession: React.Dispatch<React.SetStateAction<Record<string, CliHistoryEntry[]>>>;
  setCwdBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};
