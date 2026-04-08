import type { CopilotKitProps } from '@copilotkit/react-core';
import type { UIMessage } from 'ai';
import type { Message as ChatSdkMessage } from 'chat';
import { COPILOT_RUNTIME_URL } from '../config';
import type { ChatMessage } from '../types';

export function toAiSdkMessages(messages: ChatMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.streamedContent || message.content }],
  })) as UIMessage[];
}

export function toChatSdkTranscript(messages: ChatMessage[]): Array<Partial<ChatSdkMessage> & { id: string; text: string; role: string }> {
  return messages.map((message) => ({
    id: message.id,
    text: message.streamedContent || message.content,
    role: message.role,
  }));
}

export function createCopilotBridgeSnapshot(messages: ChatMessage[]): Pick<CopilotKitProps, 'runtimeUrl'> & { messageCount: number } {
  return { runtimeUrl: COPILOT_RUNTIME_URL, messageCount: messages.length };
}
