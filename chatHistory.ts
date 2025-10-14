export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMessage = { id: string; role: ChatRole; content: string };

const historyStore = new Map<string, ChatMessage[]>();

export function ensureHistory(sessionId: string): ChatMessage[] {
  const existing = historyStore.get(sessionId);
  if (existing) {
    return existing;
  }
  const history: ChatMessage[] = [];
  historyStore.set(sessionId, history);
  return history;
}

export function pushTrim(history: ChatMessage[], message: ChatMessage, limit: number): void {
  history.push(message);
  if (history.length > limit) {
    history.splice(0, history.length - limit);
  }
}

export function createMessage(role: ChatRole, content: string): ChatMessage {
  return { id: `m-${crypto.randomUUID()}`, role, content };
}