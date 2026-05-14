import { randomUUID } from 'node:crypto';
import type { HarnessPlugin } from 'harness-core';

export type LiveShareRole = 'viewer' | 'controller';
export type SessionAction = 'view' | 'control' | 'transfer-control';

export interface LiveSharePolicy {
  allowAnonymousView: boolean;
  allowedUsers: string[];
  controlUsers: string[];
  allowControlTransfer: boolean;
}

export interface LiveShareSession {
  sessionId: string;
  ownerId: string;
  policy: LiveSharePolicy;
  webrtcChannel: string;
}

export interface AuthorizeResult {
  approved: boolean;
  role: LiveShareRole;
  grants: SessionAction[];
  reason?: string;
}

export function normalizePolicy(policy: LiveSharePolicy): LiveSharePolicy {
  return {
    allowAnonymousView: policy.allowAnonymousView,
    allowControlTransfer: policy.allowControlTransfer,
    allowedUsers: [...new Set(policy.allowedUsers)].sort(),
    controlUsers: [...new Set(policy.controlUsers)].sort(),
  };
}

export function authorizeParticipant(session: LiveShareSession, userId: string | null): AuthorizeResult {
  const policy = session.policy;

  if (userId === null && !policy.allowAnonymousView) {
    return { approved: false, role: 'viewer', grants: [], reason: 'Anonymous viewers are not allowed.' };
  }

  const canView = userId !== null
    ? policy.allowedUsers.includes(userId) || policy.controlUsers.includes(userId) || session.ownerId === userId
    : policy.allowAnonymousView;

  if (!canView) {
    return { approved: false, role: 'viewer', grants: [], reason: 'User is not listed in the share policy.' };
  }

  const isController = userId !== null && (session.ownerId === userId || policy.controlUsers.includes(userId));
  const grants: SessionAction[] = isController
    ? policy.allowControlTransfer ? ['view', 'control', 'transfer-control'] : ['view', 'control']
    : ['view'];

  return {
    approved: true,
    role: isController ? 'controller' : 'viewer',
    grants,
  };
}

function asStartArgs(args: unknown): { ownerId: string; policy: LiveSharePolicy } {
  const candidate = args as { ownerId?: string; policy?: LiveSharePolicy };
  if (!candidate.ownerId || !candidate.policy) {
    throw new Error('ownerId and policy are required.');
  }
  return { ownerId: candidate.ownerId, policy: candidate.policy };
}

function asAuthorizeArgs(args: unknown): { sessionId: string; userId: string | null } {
  const candidate = args as { sessionId?: string; userId?: string | null };
  if (!candidate.sessionId) {
    throw new Error('sessionId is required.');
  }
  return { sessionId: candidate.sessionId, userId: candidate.userId ?? null };
}

export function createLiveSharePlugin(): HarnessPlugin {
  const sessions = new Map<string, LiveShareSession>();

  return {
    id: 'live-share',
    register({ tools }) {
      tools.register({
        id: 'live-share.start',
        description: 'Create an owner-defined policy for a WebRTC live-share session.',
        inputSchema: {
          type: 'object',
          required: ['ownerId', 'policy'],
          properties: {
            ownerId: { type: 'string' },
            policy: { type: 'object' },
          },
        },
        execute: (args: unknown) => {
          const { ownerId, policy } = asStartArgs(args);
          const sessionId = randomUUID();
          const session: LiveShareSession = {
            sessionId,
            ownerId,
            webrtcChannel: `live-share:${sessionId}`,
            policy: normalizePolicy(policy),
          };
          sessions.set(sessionId, session);
          return session;
        },
      });

      tools.register({
        id: 'live-share.authorize',
        description: 'Authorize a user against a session policy and return allowed live-share actions.',
        inputSchema: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
            userId: { type: ['string', 'null'] },
          },
        },
        execute: (args: unknown) => {
          const { sessionId, userId } = asAuthorizeArgs(args);
          const session = sessions.get(sessionId);
          if (!session) {
            return { approved: false, role: 'viewer', grants: [], reason: 'Unknown live-share session.' } as AuthorizeResult;
          }
          return authorizeParticipant(session, userId);
        },
      });
    },
  };
}
