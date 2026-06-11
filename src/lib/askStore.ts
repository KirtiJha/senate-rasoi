import { AskResultItem } from './ai';

/**
 * In-memory store for the Ask Aangan conversation, so the chat survives
 * navigating away and back within a session (the /ask screen unmounts on
 * navigation). Cleared on reload or via "New chat".
 */
export interface AskMessage {
  role: 'user' | 'assistant';
  text: string;
  results?: AskResultItem[];
}

let conversation: AskMessage[] = [];

export function getAskConversation(): AskMessage[] {
  return conversation;
}
export function setAskConversation(next: AskMessage[]): void {
  conversation = next;
}
export function clearAskConversation(): void {
  conversation = [];
}
