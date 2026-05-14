import { createHarnessExtensionContext } from 'harness-core';
import { describe, expect, it } from 'vitest';

import { authorizeParticipant, createLiveSharePlugin, normalizePolicy, type LiveShareSession } from './index.js';

describe('live-share plugin', () => {
  it('normalizes policies and enforces policy-gated authorization grants', async () => {
    const policy = normalizePolicy({
      allowAnonymousView: false,
      allowControlTransfer: true,
      allowedUsers: ['alice', 'alice', 'eve'],
      controlUsers: ['bob', 'bob'],
    });

    expect(policy).toEqual({
      allowAnonymousView: false,
      allowControlTransfer: true,
      allowedUsers: ['alice', 'eve'],
      controlUsers: ['bob'],
    });

    const mockSession: LiveShareSession = {
      sessionId: 's1',
      ownerId: 'owner',
      webrtcChannel: 'live-share:s1',
      policy,
    };

    expect(authorizeParticipant(mockSession, null)).toEqual({
      approved: false,
      role: 'viewer',
      grants: [],
      reason: 'Anonymous viewers are not allowed.',
    });
    expect(authorizeParticipant(mockSession, 'mallory').reason).toContain('not listed');
    expect(authorizeParticipant(mockSession, 'eve')).toEqual({ approved: true, role: 'viewer', grants: ['view'] });
    expect(authorizeParticipant(mockSession, 'bob')).toEqual({ approved: true, role: 'controller', grants: ['view', 'control', 'transfer-control'] });
    expect(authorizeParticipant(mockSession, 'owner')).toEqual({ approved: true, role: 'controller', grants: ['view', 'control', 'transfer-control'] });

    const context = createHarnessExtensionContext();
    await context.plugins.load(createLiveSharePlugin());

    const started = await context.tools.execute('live-share.start', {
      ownerId: 'owner',
      policy: {
        allowAnonymousView: true,
        allowControlTransfer: false,
        allowedUsers: ['viewer'],
        controlUsers: ['controller'],
      },
    }) as LiveShareSession;

    expect(started.webrtcChannel).toContain(started.sessionId);

    await expect(context.tools.execute('live-share.authorize', { sessionId: 'missing', userId: 'viewer' })).resolves.toEqual({
      approved: false,
      role: 'viewer',
      grants: [],
      reason: 'Unknown live-share session.',
    });

    await expect(context.tools.execute('live-share.authorize', { sessionId: started.sessionId })).resolves.toEqual({
      approved: true,
      role: 'viewer',
      grants: ['view'],
    });
    await expect(context.tools.execute('live-share.authorize', { sessionId: started.sessionId, userId: 'controller' })).resolves.toEqual({
      approved: true,
      role: 'controller',
      grants: ['view', 'control'],
    });

    await expect(context.tools.execute('live-share.start', { ownerId: 'owner' })).rejects.toThrow('ownerId and policy are required.');
    await expect(context.tools.execute('live-share.authorize', { userId: 'controller' })).rejects.toThrow('sessionId is required.');
  });
});
