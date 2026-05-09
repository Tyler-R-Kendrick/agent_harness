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
  setBashHistoryBySession: React.Dispatch<React.SetStateAction<Record<string, CliHistoryEntry[]>>>;
  setCwdBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};
