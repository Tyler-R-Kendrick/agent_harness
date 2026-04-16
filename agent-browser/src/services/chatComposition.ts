import type { UIMessage } from 'ai';
import type { Message as ChatSdkMessage } from 'chat';
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

export function appendPendingLocalTurn(
  messages: ChatMessage[],
  text: string,
  ids: { userId: string; assistantId: string },
): ChatMessage[] {
  return [
    ...messages,
    { id: ids.userId, role: 'user', content: text },
    { id: ids.assistantId, role: 'assistant', content: '', status: 'thinking' },
  ];
}
