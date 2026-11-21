"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import {
  ChatError, chatErrorMessage, fetchThread, sendChat, type ChatMessage, type Connection,
} from "../lib/chat";
import FlagBackdrop from "./FlagBackdrop";

function mergeMessages(current: ChatMessage[], added: ChatMessage[]) {
  const unique = new Map([...current, ...added].map(message => [message.id, message]));
  return [...unique.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
}

export default function ChatMessages({ connection, refresh }: { connection: Connection; refresh: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [fetchIssue, setFetchIssue] = useState("");
  const [writeIssue, setWriteIssue] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const retry = useRef<{ id: string; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cursor: string | undefined;
    let first = true;
    async function pull() {
      let delay = 4000;
      try {
        const page = await fetchThread(connection.id, { after: cursor }, controller.signal);
        if (controller.signal.aborted) return;
        if (page.messages.length) {
          cursor = page.messages[page.messages.length - 1].id;
          setMessages(current => mergeMessages(current, page.messages));
        }
        cursor ??= "0";
        if (first) setHasOlder(page.hasMore);
        else if (page.hasMore) delay = 0;
        first = false;
        setLoaded(true);
        setEnded(page.connection.status === "ended");
        setFetchIssue("");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ChatError && (error.status === 401 || error.status === 404)) {
          setMessages([]);
          setUnavailable(true);
          refresh();
          return;
        }
        setFetchIssue(chatErrorMessage(error));
      }
      timer = setTimeout(pull, delay);
    }
    void pull();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [connection.id, refresh]);

  useLayoutEffect(() => {
    const log = viewport.current;
    if (!log) return;
    if (restore.current) {
      log.scrollTop = restore.current.top + log.scrollHeight - restore.current.height;
      restore.current = null;
    } else if (stick.current) {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages]);

  async function older() {
    if (loadingOlder || !messages[0]) return;
    setLoadingOlder(true);
    setWriteIssue("");
    try {
      const page = await fetchThread(connection.id, { before: messages[0].id });
      const log = viewport.current;
      if (log) restore.current = { height: log.scrollHeight, top: log.scrollTop };
      setHasOlder(page.hasMore);
      setMessages(current => mergeMessages(current, page.messages));
    } catch (error) {
      setWriteIssue(chatErrorMessage(error));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (sending || !text || ended || unavailable || connection.status !== "accepted") return;
    if (retry.current?.text !== text) retry.current = { id: crypto.randomUUID(), text };
    setSending(true);
    setWriteIssue("");
    try {
      const { message } = await sendChat(connection.id, retry.current.id, text);
      retry.current = null;
      stick.current = true;
      setMessages(current => mergeMessages(current, [message]));
      setDraft("");
    } catch (error) {
      setWriteIssue(chatErrorMessage(error));
      if (error instanceof ChatError && (error.status === 401 || error.status === 404 || error.status === 409)) refresh();
    } finally {
      setSending(false);
    }
  }

  const writable = loaded && !ended && !unavailable && connection.status === "accepted";
  const day = (stamp: string) => new Date(stamp).toDateString();
  return (
    <>
      <div className="chat-thread" data-flag={connection.story?.flag ?? "rye"}>
        <FlagBackdrop flag={connection.story?.flag ?? "rye"} />
        <div className="chat-messages" ref={viewport} tabIndex={0} role="log" aria-label={"Messages with " + connection.name}
          onScroll={event => {
            const log = event.currentTarget;
            stick.current = log.scrollHeight - log.clientHeight - log.scrollTop < 80;
          }}>
          {hasOlder && <button type="button" className="btn outline chat-earlier" disabled={loadingOlder} onClick={older}>Earlier messages</button>}
          {!messages.length && <p className="chat-starter">{unavailable ? "This conversation is unavailable."
            : loaded ? "You’re connected. Say hello when you’re ready." : fetchIssue || "Loading messages…"}</p>}
          {messages.map((message, index) => {
            const date = new Date(message.createdAt);
            return <Fragment key={message.id}>
              {(index === 0 || day(messages[index - 1].createdAt) !== day(message.createdAt)) && (
                <p className="chat-day">{date.toDateString() === new Date().toDateString() ? "Today"
                  : date.toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
              )}
              <div className="chat-bubble" data-from={message.mine ? "you" : "contact"}>
                <p><span className="sr-only">{message.mine ? "You" : connection.name}: </span>{message.text}</p>
                <time dateTime={message.createdAt}>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
              </div>
            </Fragment>;
          })}
        </div>
      </div>
      {writable ? (
        <form className="chat-compose" onSubmit={submit}>
          <label className="sr-only" htmlFor="connection-message">Message</label>
          <input id="connection-message" type="text" value={draft} maxLength={1000}
            onChange={event => setDraft(event.target.value)} readOnly={sending} placeholder="Write a message…" autoComplete="off" />
          <button className="btn dark" type="submit" disabled={sending || !draft.trim()}><Send size={16} aria-hidden="true" /> Send</button>
        </form>
      ) : (ended || connection.status === "ended") && (
        <p className="chat-compose chat-closed">This conversation has ended.</p>
      )}
      {(writeIssue || (loaded && fetchIssue)) && <p className="chat-inline-issue" role="status">{writeIssue || fetchIssue}</p>}
    </>
  );
}
