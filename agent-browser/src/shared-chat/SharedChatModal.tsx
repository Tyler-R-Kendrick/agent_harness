import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_WEBRTC_CHAT_CHANNEL,
  buildChatChannelHandoffPayload,
  formatChatChannelHandoffMessage,
  type ChatChannelOption,
} from '../services/chatChannels';
import {
  MAX_QUEUED_OUTBOUND_BYTES,
  PeerRateLimiter,
  compressSdp,
  createOwnerDataChannels,
  createPeerConnection,
  createSignedEvent,
  decodePayload,
  decompressSdp,
  derivePairingCode,
  encodePayload,
  hashSdp,
  loadOrCreateDeviceIdentity,
  markEventAccepted,
  parseAnswerPayload,
  parseInvitePayload,
  renderQrDataUrl,
  sanitizeChatText,
  secureRandomToken,
  signAnswerPayload,
  validateInboundEvent,
  verifyAnswerPayload,
  waitForIceGatheringComplete,
  type DeviceRecord,
  type InvitePayload,
  type SessionState,
  type SharedDataChannels,
  type StoredDeviceIdentity,
} from '.';

type BarcodeDetectorShape = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorShape;

type SharedChatPhase = 'home' | 'owner-invite' | 'join-scan' | 'join-answer' | 'owner-answer-scan' | 'confirm' | 'chat' | 'ended';

export type SharedChatApi = {
  active: boolean;
  confirmed: boolean;
  peerLabel?: string;
  deviceLabel?: string;
  sendText: (text: string) => Promise<void>;
  endSession: () => Promise<void>;
};

export function SharedChatModal({
  open,
  sessionId,
  workspaceName,
  onClose,
  onApiChange,
  onRemoteMessage,
  onStatusMessage,
  onToast,
  onCopyToClipboard,
  channelOptions = [DEFAULT_WEBRTC_CHAT_CHANNEL],
}: {
  open: boolean;
  sessionId: string;
  workspaceName: string;
  channelOptions?: readonly ChatChannelOption[];
  onClose: () => void;
  onApiChange: (api: SharedChatApi | null) => void;
  onRemoteMessage: (text: string, peerLabel: string) => void;
  onStatusMessage: (text: string) => void;
  onToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onCopyToClipboard: (text: string, label: string) => Promise<void>;
}) {
  const [phase, setPhase] = useState<SharedChatPhase>('home');
  const [inviteCode, setInviteCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [peerLabel, setPeerLabel] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState('idle');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [status, setStatus] = useState('QR codes are untrusted. Confirm the pairing code before chat events are accepted.');
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelsRef = useRef<SharedDataChannels>({});
  const identityRef = useRef<StoredDeviceIdentity | null>(null);
  const sessionRef = useRef<SessionState | null>(null);
  const pendingPeerRef = useRef<DeviceRecord | null>(null);
  const pairingContextRef = useRef<{
    ownerDeviceId: string;
    joiningDeviceId: string;
    ownerPublicKey: JsonWebKey;
    joiningPublicKey: JsonWebKey;
    offerHash: string;
    answerHash: string;
  } | null>(null);
  const rateLimiterRef = useRef(new PeerRateLimiter());
  const normalizedChannelOptions = channelOptions.length ? channelOptions : [DEFAULT_WEBRTC_CHAT_CHANNEL];
  const externalChannelOptions = normalizedChannelOptions.filter((channel) => channel.kind !== 'webrtc');

  const closePeer = useCallback(() => {
    for (const channel of Object.values(channelsRef.current)) channel?.close();
    channelsRef.current = {};
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const publishApi = useCallback((nextPhase = phase) => {
    const session = sessionRef.current;
    if (!session || session.ended || nextPhase === 'ended') {
      onApiChange(null);
      return;
    }
    onApiChange({
      active: true,
      confirmed: session.pairingConfirmed,
      peerLabel: peerLabel ?? undefined,
      deviceLabel: peerLabel ?? undefined,
      sendText: async (text: string) => {
        await sendSharedText(text);
      },
      endSession: async () => {
        await endSharedSession('user_requested');
      },
    });
  }, [onApiChange, phase]);

  useEffect(() => {
    publishApi();
    return () => onApiChange(null);
  }, [onApiChange, phase, publishApi]);

  useEffect(() => () => closePeer(), [closePeer]);

  const fail = useCallback((message: string) => {
    setError(message);
    setStatus(message);
    onToast(message, 'error');
  }, [onToast]);

  const updateConnectionState = useCallback((pc: RTCPeerConnection) => {
    const update = () => setConnectionState(pc.connectionState || pc.iceConnectionState);
    pc.addEventListener('connectionstatechange', update);
    pc.addEventListener('iceconnectionstatechange', update);
    update();
  }, []);

  const attachChannel = useCallback((channel: RTCDataChannel | undefined, kind: 'chat' | 'control' | 'presence') => {
    if (!channel) return;
    channel.onopen = () => {
      setConnectionState('connected');
      publishApi('chat');
    };
    channel.onclose = () => setConnectionState('closed');
    channel.onerror = () => fail('DataChannel closed because of a protocol or network error.');
    if (kind === 'presence') return;
    channel.onmessage = (event) => {
      void handleInboundData(kind, event.data);
    };
  }, [fail, publishApi]);

  const setChannels = useCallback((channels: SharedDataChannels) => {
    channelsRef.current = { ...channelsRef.current, ...channels };
    attachChannel(channels.chat, 'chat');
    attachChannel(channels.control, 'control');
    attachChannel(channels.presence, 'presence');
  }, [attachChannel]);

  const handleDataChannel = useCallback((event: RTCDataChannelEvent) => {
    const channel = event.channel;
    if (channel.label === 'chat-events') setChannels({ chat: channel });
    if (channel.label === 'control') setChannels({ control: channel });
    if (channel.label === 'presence') setChannels({ presence: channel });
  }, [setChannels]);

  async function handleInboundData(kind: 'chat' | 'control', data: unknown) {
    const session = sessionRef.current;
    if (!session) return;
    try {
      const raw = typeof data === 'string' ? JSON.parse(data) : data;
      const event = await validateInboundEvent({ event: raw, session, rateLimiter: rateLimiterRef.current });
      const nextSession = markEventAccepted(session, event);
      sessionRef.current = nextSession;
      if (event.type === 'message.created' && kind === 'chat') {
        onRemoteMessage(sanitizeChatText(event.payload.text), nextSession.devices[event.deviceId]?.label ?? 'Peer device');
      }
      if (event.type === 'session.ended') {
        sessionRef.current = { ...nextSession, ended: true };
        setPhase('ended');
        setStatus('Session ended by peer.');
        onStatusMessage('Shared session ended by peer.');
        onToast('Shared session ended by peer', 'info');
        closePeer();
      }
      publishApi();
    } catch (reason) {
      console.warn('Rejected shared chat event', reason);
      setStatus('Protocol violation: rejected an untrusted or invalid event.');
    }
  }

  async function sendSignedControl(reason: 'user_requested' | 'protocol_error') {
    const session = sessionRef.current;
    const identity = identityRef.current;
    if (!session?.pairingConfirmed || !identity?.privateKey) return;
    const event = await createSignedEvent({ session, privateKey: identity.privateKey, type: 'session.ended', payload: { reason } });
    sessionRef.current = markEventAccepted(session, event);
    channelsRef.current.control?.send(JSON.stringify(event));
  }

  async function endSharedSession(reason: 'user_requested' | 'protocol_error') {
    try {
      await sendSignedControl(reason);
    } finally {
      if (sessionRef.current) sessionRef.current = { ...sessionRef.current, ended: true };
      setPhase('ended');
      setStatus('Shared session ended locally.');
      onStatusMessage('Shared session ended locally.');
      closePeer();
      publishApi('ended');
    }
  }

  async function sendSharedText(text: string) {
    const session = sessionRef.current;
    const identity = identityRef.current;
    const chat = channelsRef.current.chat;
    const cleaned = sanitizeChatText(text.trim());
    if (!session?.pairingConfirmed || !identity?.privateKey || !chat || chat.readyState !== 'open' || !cleaned) return;
    if (chat.bufferedAmount > MAX_QUEUED_OUTBOUND_BYTES) {
      fail('Shared chat is backpressured. Try again after the peer catches up.');
      return;
    }
    const event = await createSignedEvent({ session, privateKey: identity.privateKey, type: 'message.created', payload: { text: cleaned } });
    sessionRef.current = markEventAccepted(session, event);
    chat.send(JSON.stringify(event));
    publishApi();
  }

  const buildSession = useCallback(async (args: { role: 'owner' | 'contributor'; identity: StoredDeviceIdentity; ownerDeviceId: string; ownerPublicKey: JsonWebKey; expiresAt: number; peer?: DeviceRecord; protocolSessionId?: string }): Promise<SessionState> => {
    const local: DeviceRecord = {
      deviceId: args.identity.deviceId,
      label: args.identity.label,
      publicKeyJwk: args.identity.publicKeyJwk,
      role: args.role,
      approved: args.role === 'owner',
      revoked: false,
      joinedAt: Date.now(),
    };
    const owner: DeviceRecord = args.role === 'owner'
      ? local
      : {
          deviceId: args.ownerDeviceId,
          label: 'Owner device',
          publicKeyJwk: args.ownerPublicKey,
          role: 'owner',
          approved: false,
          revoked: false,
          joinedAt: Date.now(),
        };
    const devices: Record<string, DeviceRecord> = { [owner.deviceId]: owner, [local.deviceId]: local };
    if (args.peer) devices[args.peer.deviceId] = args.peer;
    return {
      version: 1,
      sessionId: args.protocolSessionId ?? sessionId,
      localDeviceId: args.identity.deviceId,
      ownerDeviceId: args.ownerDeviceId,
      peerDeviceId: args.peer?.deviceId,
      epoch: 0,
      pairingConfirmed: false,
      devices,
      lastSeqByDevice: {},
      seenEventIds: {},
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
      ended: false,
    };
  }, [sessionId]);

  const startOwnerInvite = useCallback(async () => {
    setError(null);
    setStatus('Creating a STUN-only WebRTC offer and QR invite…');
    try {
      closePeer();
      const identity = await loadOrCreateDeviceIdentity(`Owner · ${workspaceName}`);
      identityRef.current = identity;
      if (identity.warning) onToast(identity.warning, 'warning');
      const pc = createPeerConnection();
      pcRef.current = pc;
      updateConnectionState(pc);
      const ownerChannels = createOwnerDataChannels(pc);
      setChannels(ownerChannels);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) throw new Error('Unable to create offer.');
      const expiry = Date.now() + 5 * 60 * 1000;
      const compressedOffer = await compressSdp(localSdp);
      const payload: InvitePayload = {
        v: 1,
        type: 'invite',
        sessionId,
        ownerDeviceId: identity.deviceId,
        ownerLabel: identity.label,
        ownerPublicKey: identity.publicKeyJwk,
        offer: compressedOffer,
        offerHash: await hashSdp(localSdp),
        expiresAt: expiry,
        nonce: secureRandomToken(),
      };
      const encoded = await encodePayload(payload);
      setInviteCode(encoded);
      setQrDataUrl(await renderQrDataUrl(encoded));
      setExpiresAt(expiry);
      sessionRef.current = await buildSession({ role: 'owner', identity, ownerDeviceId: identity.deviceId, ownerPublicKey: identity.publicKeyJwk, expiresAt: expiry });
      pairingContextRef.current = null;
      setPhase('owner-invite');
      setStatus('Invite QR ready. On the second device, choose Join shared session and scan or paste this code.');
      publishApi('owner-invite');
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : 'Failed to create invite QR.');
    }
  }, [buildSession, closePeer, fail, onToast, publishApi, sessionId, setChannels, updateConnectionState, workspaceName]);

  const createJoinAnswer = useCallback(async (encodedInvite: string) => {
    setError(null);
    setStatus('Validating invite QR and creating signed answer…');
    try {
      const invite = parseInvitePayload(await decodePayload(encodedInvite.trim()));
      if (invite.expiresAt < Date.now()) throw new Error('Invite expired.');
      closePeer();
      const identity = await loadOrCreateDeviceIdentity(`Peer · ${workspaceName}`);
      identityRef.current = identity;
      if (identity.warning) onToast(identity.warning, 'warning');
      const pc = createPeerConnection();
      pcRef.current = pc;
      updateConnectionState(pc);
      pc.ondatachannel = handleDataChannel;
      const offerSdp = await decompressSdp(invite.offer);
      if (await hashSdp(offerSdp) !== invite.offerHash) throw new Error('Invalid QR payload.');
      await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGatheringComplete(pc);
      const answerSdp = pc.localDescription?.sdp;
      if (!answerSdp) throw new Error('Unable to create answer.');
      const expiry = Date.now() + 5 * 60 * 1000;
      const unsigned = {
        v: 1 as const,
        type: 'answer' as const,
        sessionId: invite.sessionId,
        joiningDeviceId: identity.deviceId,
        joiningLabel: identity.label,
        joiningPublicKey: identity.publicKeyJwk,
        answer: await compressSdp(answerSdp),
        answerHash: await hashSdp(answerSdp),
        expiresAt: expiry,
        nonce: secureRandomToken(),
      };
      if (!identity.privateKey) throw new Error('Device signing key is unavailable. Re-pair this device.');
      const signed = await signAnswerPayload(identity.privateKey, unsigned);
      const encodedAnswer = await encodePayload(signed);
      setAnswerCode(encodedAnswer);
      setQrDataUrl(await renderQrDataUrl(encodedAnswer));
      setExpiresAt(expiry);
      setPeerLabel(invite.ownerLabel);
      sessionRef.current = await buildSession({ role: 'contributor', identity, ownerDeviceId: invite.ownerDeviceId, ownerPublicKey: invite.ownerPublicKey, expiresAt: expiry, protocolSessionId: invite.sessionId });
      pairingContextRef.current = {
        ownerDeviceId: invite.ownerDeviceId,
        joiningDeviceId: identity.deviceId,
        ownerPublicKey: invite.ownerPublicKey,
        joiningPublicKey: identity.publicKeyJwk,
        offerHash: invite.offerHash,
        answerHash: signed.answerHash,
      };
      setPairingCode(await derivePairingCode({ sessionId: invite.sessionId, ...pairingContextRef.current }));
      setPhase('join-answer');
      setStatus('Answer QR ready. Scan it from the owner device, then confirm the pairing code on both devices.');
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : 'Invalid QR payload.');
    }
  }, [buildSession, closePeer, fail, handleDataChannel, onToast, updateConnectionState, workspaceName]);

  const acceptOwnerAnswer = useCallback(async (encodedAnswer: string) => {
    setError(null);
    setStatus('Validating signed answer QR…');
    try {
      const session = sessionRef.current;
      const pc = pcRef.current;
      const identity = identityRef.current;
      if (!session || !pc || !identity) throw new Error('Start an invite before scanning an answer.');
      const answer = parseAnswerPayload(await decodePayload(encodedAnswer.trim()));
      if (answer.expiresAt < Date.now()) throw new Error('Answer expired.');
      if (answer.sessionId !== session.sessionId) throw new Error('Answer is for a different session.');
      if (!await verifyAnswerPayload(answer)) throw new Error('Signature verification failed.');
      const answerSdp = await decompressSdp(answer.answer);
      if (await hashSdp(answerSdp) !== answer.answerHash) throw new Error('Invalid QR payload.');
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      const peer: DeviceRecord = {
        deviceId: answer.joiningDeviceId,
        label: answer.joiningLabel,
        publicKeyJwk: answer.joiningPublicKey,
        role: 'contributor',
        approved: false,
        revoked: false,
        joinedAt: Date.now(),
      };
      pendingPeerRef.current = peer;
      sessionRef.current = { ...session, peerDeviceId: peer.deviceId, devices: { ...session.devices, [peer.deviceId]: peer } };
      pairingContextRef.current = {
        ownerDeviceId: identity.deviceId,
        joiningDeviceId: answer.joiningDeviceId,
        ownerPublicKey: identity.publicKeyJwk,
        joiningPublicKey: answer.joiningPublicKey,
        offerHash: (await parseInvitePayload(await decodePayload(inviteCode))).offerHash,
        answerHash: answer.answerHash,
      };
      setPeerLabel(answer.joiningLabel);
      setPairingCode(await derivePairingCode({ sessionId: answer.sessionId, ...pairingContextRef.current }));
      setPhase('confirm');
      setStatus('Confirm this exact pairing code appears on the joining device. Chat remains blocked until confirmed.');
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : 'Invalid answer QR.');
    }
  }, [fail, inviteCode]);

  const confirmPairing = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const nextDevices = { ...session.devices };
    if (pendingPeerRef.current) {
      nextDevices[pendingPeerRef.current.deviceId] = { ...pendingPeerRef.current, approved: true };
    }
    for (const [deviceId, record] of Object.entries(nextDevices)) {
      nextDevices[deviceId] = { ...record, approved: true };
    }
    sessionRef.current = { ...session, devices: nextDevices, pairingConfirmed: true, peerDeviceId: pendingPeerRef.current?.deviceId ?? session.peerDeviceId };
    setPhase('chat');
    setStatus('Shared session active. Durable chat and control events are signed and replay-protected.');
    onStatusMessage('Shared session active. Pairing confirmed.');
    onToast('Shared session active', 'success');
    publishApi('chat');
  }, [onStatusMessage, onToast, publishApi]);

  const copyCode = useCallback(async (value: string, label: string) => {
    await onCopyToClipboard(value, label);
    onToast(`${label} copied`, 'success');
  }, [onCopyToClipboard, onToast]);

  const shareViaExternalChannel = useCallback(async (channel: ChatChannelOption) => {
    const payload = buildChatChannelHandoffPayload(channel, { sessionId, workspaceName });
    const message = formatChatChannelHandoffMessage(payload);
    try {
      await onCopyToClipboard(message, `${channel.label} channel handoff`);
      const statusMessage = `${channel.label} handoff copied. Send it through the configured channel extension to delegate or continue this chat.`;
      setStatus(statusMessage);
      onStatusMessage(statusMessage);
      onToast(`${channel.label} handoff copied`, 'success');
    } catch {
      fail(`Failed to copy ${channel.label} handoff.`);
    }
  }, [fail, onCopyToClipboard, onStatusMessage, onToast, sessionId, workspaceName]);

  return open ? (
    <div className="shared-chat-backdrop" role="dialog" aria-modal="true" aria-label="Share chat session">
      <section className="shared-chat-modal">
        <header className="shared-chat-modal-header">
          <div>
            <p className="panel-eyebrow">Secure shared chat</p>
            <h2>QR-paired WebRTC session</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close share dialog" onClick={onClose}>×</button>
        </header>
        <div className="shared-chat-security-strip">QR is untrusted signaling · WebRTC DataChannels · signed append-only events · explicit pairing confirmation</div>
        {error ? <div className="shared-chat-error">{error}</div> : null}
        <div className="shared-chat-body">
          {phase === 'home' ? (
            <>
              <div className="shared-chat-grid">
                <ActionCard title="Start shared session" body="Create an invite QR on this device. The peer scans it, then shows a signed answer QR." onClick={() => void startOwnerInvite()} />
                <ActionCard title="Join shared session" body="Scan or paste the owner invite. This device creates a signed answer QR." onClick={() => { setPhase('join-scan'); setQrDataUrl(null); }} />
              </div>
              <ChannelOptionsPanel channels={normalizedChannelOptions} externalChannels={externalChannelOptions} onShareExternal={(channel) => void shareViaExternalChannel(channel)} />
            </>
          ) : null}
          {phase === 'owner-invite' ? (
            <QrPayloadPanel title="Invite QR" qrDataUrl={qrDataUrl} code={inviteCode} expiresAt={expiresAt} onCopy={(value) => void copyCode(value, 'Invite code')}>
              <button type="button" className="primary-button" onClick={() => { setPhase('owner-answer-scan'); setQrDataUrl(null); }}>Scan answer QR</button>
            </QrPayloadPanel>
          ) : null}
          {phase === 'join-scan' ? <ScanPanel label="Paste or scan invite payload" onSubmit={(value) => void createJoinAnswer(value)} scannerActive={scannerActive} setScannerActive={setScannerActive} /> : null}
          {phase === 'join-answer' ? (
            <QrPayloadPanel title="Answer QR" qrDataUrl={qrDataUrl} code={answerCode} expiresAt={expiresAt} onCopy={(value) => void copyCode(value, 'Answer code')}>
              <PairingConfirmation pairingCode={pairingCode} peerLabel={peerLabel} onConfirm={confirmPairing} onCancel={() => void endSharedSession('user_requested')} />
            </QrPayloadPanel>
          ) : null}
          {phase === 'owner-answer-scan' ? <ScanPanel label="Paste or scan signed answer payload" onSubmit={(value) => void acceptOwnerAnswer(value)} scannerActive={scannerActive} setScannerActive={setScannerActive} /> : null}
          {phase === 'confirm' ? <PairingConfirmation pairingCode={pairingCode} peerLabel={peerLabel} onConfirm={confirmPairing} onCancel={() => void endSharedSession('user_requested')} /> : null}
          {phase === 'chat' ? <ActiveSharedSession peerLabel={peerLabel} connectionState={connectionState} onEnd={() => void endSharedSession('user_requested')} /> : null}
          {phase === 'ended' ? <div className="shared-chat-ended"><h3>Session ended</h3><p>Local channels are closed. Already-delivered messages remain on the other device.</p></div> : null}
        </div>
        <footer className="shared-chat-footer">
          <span>{status}</span>
          {phase !== 'home' && phase !== 'ended' ? <button type="button" className="secondary-button" onClick={() => void endSharedSession('user_requested')}>End session</button> : null}
        </footer>
      </section>
    </div>
  ) : null;
}

function ActionCard({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return <button type="button" className="shared-chat-action-card" onClick={onClick}><strong>{title}</strong><span>{body}</span></button>;
}

function ChannelOptionsPanel({ channels, externalChannels, onShareExternal }: { channels: readonly ChatChannelOption[]; externalChannels: readonly ChatChannelOption[]; onShareExternal: (channel: ChatChannelOption) => void }) {
  return (
    <section className="shared-chat-channel-options" aria-label="Channel share options">
      <div className="shared-chat-channel-summary">
        <strong>Channels</strong>
        <span>{channels.map((channel) => channel.label).join(' · ')}</span>
      </div>
      {externalChannels.length ? (
        <div className="shared-chat-channel-list" role="list">
          {externalChannels.map((channel) => (
            <article key={channel.id} className="shared-chat-channel-row" role="listitem">
              <div>
                <strong>{channel.label}</strong>
                <span>{channel.capabilities.join(', ')}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => onShareExternal(channel)}>Share with {channel.label}</button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function QrPayloadPanel({ title, qrDataUrl, code, expiresAt, onCopy, children }: { title: string; qrDataUrl: string | null; code: string; expiresAt: number | null; onCopy: (code: string) => void; children: React.ReactNode }) {
  const seconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : null;
  return <div className="shared-chat-payload-panel"><h3>{title}</h3>{qrDataUrl ? <img src={qrDataUrl} alt={`${title} code`} className="shared-chat-qr" /> : <div className="shared-chat-qr-placeholder">Generating QR…</div>}<textarea readOnly value={code} aria-label={`${title} fallback code`} /><div className="shared-chat-payload-actions"><button type="button" className="secondary-button" onClick={() => onCopy(code)}>Copy fallback code</button>{seconds !== null ? <span>Expires in {seconds}s</span> : null}</div>{code.length > 2400 ? <p className="shared-chat-warning">Payload is large. Use copy/paste fallback if QR scanning fails.</p> : null}{children}</div>;
}

function ScanPanel({ label, onSubmit, scannerActive, setScannerActive }: { label: string; onSubmit: (value: string) => void; scannerActive: boolean; setScannerActive: (active: boolean) => void }) {
  const [value, setValue] = useState('');
  return <div className="shared-chat-scan"><h3>{label}</h3><NativeQrScanner active={scannerActive} onScan={(result) => { setValue(result); onSubmit(result); }} onError={() => setScannerActive(false)} /><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste QR payload fallback code" aria-label={label} /><div className="shared-chat-payload-actions"><button type="button" className="secondary-button" onClick={() => setScannerActive(!scannerActive)}>{scannerActive ? 'Stop camera scan' : 'Scan with camera'}</button><button type="button" className="primary-button" onClick={() => onSubmit(value)}>Use pasted code</button></div></div>;
}

function NativeQrScanner({ active, onScan, onError }: { active: boolean; onScan: (value: string) => void; onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    const BarcodeDetectorCtor = 'BarcodeDetector' in window
      ? (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
      : undefined;
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      onError();
      return undefined;
    }
    const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then((nextStream) => {
      if (cancelled) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = nextStream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const scan = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes.find((code) => code.rawValue)?.rawValue;
          if (raw) {
            onScan(raw);
            return;
          }
        } catch {
          // keep scanning unless the browser stops the stream
        }
        frame = requestAnimationFrame(scan);
      };
      frame = requestAnimationFrame(scan);
    }).catch(() => onError());
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, onError, onScan]);
  return active ? <video ref={videoRef} className="shared-chat-scanner" autoPlay muted playsInline aria-label="QR scanner camera" /> : null;
}

function PairingConfirmation({ pairingCode, peerLabel, onConfirm, onCancel }: { pairingCode: string | null; peerLabel: string | null; onConfirm: () => void; onCancel: () => void }) {
  return <div className="shared-chat-pairing"><p>Confirm this exact code appears on both devices before accepting chat events.</p><div className="shared-chat-pairing-code">{pairingCode ?? '---- ----'}</div><span>Peer: {peerLabel ?? 'Pending peer device'}</span><div className="shared-chat-payload-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="primary-button" onClick={onConfirm} disabled={!pairingCode}>Confirm pairing</button></div></div>;
}

function ActiveSharedSession({ peerLabel, connectionState, onEnd }: { peerLabel: string | null; connectionState: string; onEnd: () => void }) {
  return <div className="shared-chat-active"><h3>Shared session active</h3><p>Local device and {peerLabel ?? 'peer device'} can contribute signed chat events.</p><dl><dt>Connection</dt><dd>{connectionState}</dd><dt>Devices</dt><dd>This browser · {peerLabel ?? 'Peer browser'}</dd></dl><button type="button" className="primary-button danger-button" onClick={onEnd}>End session</button></div>;
}
