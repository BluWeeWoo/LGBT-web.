import type { Flag } from "./voices";

export type ChatStory = {
  id: string;
  name: string;
  title: string;
  place: string;
  flag: Flag;
  portrait: string | null;
  excerpt: string;
};
export type Connection = {
  id: string;
  name: string;
  portrait: string | null;
  status: "pending" | "accepted" | "ended";
  outgoing: boolean;
  story: ChatStory | null;
};
export type Inbox = { acceptsRequests: boolean; connections: Connection[] };
export type ChatMessage = { id: string; mine: boolean; text: string; createdAt: string };
export type MessagePage = { connection: Connection; messages: ChatMessage[]; hasMore: boolean };
export type ConnectionAction = "accept" | "decline" | "withdraw" | "end" | "block";

export class ChatError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function chatApi<T>(query = "", init?: RequestInit): Promise<T> {
  const response = await fetch("/api/connections" + query, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new ChatError(response.status, data?.error || "Connections couldn’t load. Try again.");
  }
  return data as T;
}

function writeChat<T>(method: "POST" | "PATCH", data: object) {
  return chatApi<T>("", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export function fetchInbox(signal?: AbortSignal) {
  return chatApi<Inbox>("", { signal });
}

export function fetchThread(id: string, cursor: { before?: string; after?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams({ id });
  if (cursor.before) query.set("before", cursor.before);
  if (cursor.after) query.set("after", cursor.after);
  return chatApi<MessagePage>("?" + query, { signal });
}

export function requestChat(story: string) {
  return writeChat<{ id: string }>("POST", { story });
}

export function setChatPreference(acceptsRequests: boolean) {
  return writeChat<{ acceptsRequests: boolean }>("PATCH", { action: "preferences", acceptsRequests });
}

export function changeConnection(id: string, action: ConnectionAction) {
  return writeChat<{ status: string }>("PATCH", { id, action });
}

export function sendChat(id: string, clientId: string, text: string) {
  return writeChat<{ message: ChatMessage }>("POST", { id, clientId, text });
}

export function chatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Connections couldn’t load. Try again.";
}
