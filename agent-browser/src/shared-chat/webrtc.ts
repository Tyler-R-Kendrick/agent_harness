export type SharedDataChannels = {
  chat?: RTCDataChannel;
  control?: RTCDataChannel;
  presence?: RTCDataChannel;
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
}

export function createOwnerDataChannels(pc: RTCPeerConnection): Required<SharedDataChannels> {
  return {
    chat: pc.createDataChannel('chat-events', { ordered: true }),
    control: pc.createDataChannel('control', { ordered: true }),
    presence: pc.createDataChannel('presence', { ordered: false, maxRetransmits: 0 }),
  };
}

export function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export function setDataChannelHandlers(pc: RTCPeerConnection, onChannels: (channels: SharedDataChannels) => void): SharedDataChannels {
  const channels: SharedDataChannels = {};
  pc.ondatachannel = (event) => {
    if (event.channel.label === 'chat-events') channels.chat = event.channel;
    if (event.channel.label === 'control') channels.control = event.channel;
    if (event.channel.label === 'presence') channels.presence = event.channel;
    onChannels({ ...channels });
  };
  return channels;
}
