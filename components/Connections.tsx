"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Globe2, LockKeyhole, MapPin, MessageCircle, MoreHorizontal, Send, Settings2 } from "lucide-react";
import { Brand, Bloom } from "./Brand";
import { Dialog } from "./Dialog";
import { FlagChip } from "./Dialogs";
import FlagBackdrop from "./FlagBackdrop";
import ChatMessages from "./ChatMessages";
import {
  ChatError, changeConnection, chatErrorMessage, fetchInbox, requestChat, setChatPreference,
  type ChatStory, type Connection, type ConnectionAction, type Inbox,
} from "../lib/chat";
import type { Voice } from "../lib/voices";

type Section = "chats" | "requests";

function ChatAvatar({ name, portrait }: { name: string; portrait?: string | null }) {
  return <span className="chat-avatar" aria-hidden="true">
    {portrait ? <img alt="" src={portrait} /> : Array.from(name.trim())[0]?.toLocaleUpperCase() || <Bloom />}
  </span>;
}

function StoryContext({ story }: { story: ChatStory }) {
  return <aside className="connection-context" aria-label="Story details">
    <div className="connection-context-heading">
      <ChatAvatar name={story.name} portrait={story.portrait} />
      <h2>{story.name}</h2>
      {story.place && <p><MapPin size={14} aria-hidden="true" />{story.place}</p>}
    </div>
    <section className="connection-story">
      <p><BookOpen size={15} aria-hidden="true" /> From the Atlas</p>
      <h3>{story.title}</h3>
      {story.excerpt && <blockquote>{story.excerpt}</blockquote>}
      <FlagChip flag={story.flag} />
      <a className="btn outline" href={"/#story/" + story.id}>Read story</a>
    </section>
  </aside>;
}

function connectionLabel(connection: Connection) {
  if (connection.status === "accepted") return "Connected";
  if (connection.status === "ended") return "Chat ended";
  return connection.outgoing ? "Awaiting acceptance" : "Connection request";
}

export default function Connections() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [inboxIssue, setInboxIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("chats");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [storyId, setStoryId] = useState("");
  const [story, setStory] = useState<ChatStory | null>(null);
  const [storyIssue, setStoryIssue] = useState("");
  const [confirm, setConfirm] = useState<"end" | "block" | null>(null);
  const inboxVersion = useRef(0);
  const menu = useRef<HTMLDetailsElement>(null);

  const loadInbox = useCallback(async (signal?: AbortSignal) => {
    const version = ++inboxVersion.current;
    try {
      const result = await fetchInbox(signal);
      if (version === inboxVersion.current && !signal?.aborted) {
        setInbox(result);
        setSignedOut(false);
        setInboxIssue("");
      }
      return result;
    } catch (error) {
      if (version !== inboxVersion.current || signal?.aborted) return null;
      if (error instanceof ChatError && error.status === 401) {
        setInbox(null);
        setSignedOut(true);
        setInboxIssue("");
      } else {
        setInboxIssue(chatErrorMessage(error));
      }
      return null;
    }
  }, []);

  const refresh = useCallback(() => { void loadInbox(); }, [loadInbox]);
  const signedIn = inbox !== null;
  useEffect(() => {
    const controller = new AbortController();
    const sync = () => {
      if (!document.hidden) void loadInbox(controller.signal);
    };
    sync();
    const timer = signedIn ? setInterval(sync, 5000) : undefined;
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [loadInbox, signedIn]);

  useEffect(() => {
    setStoryId(new URLSearchParams(window.location.search).get("story") || "");
  }, []);

  useEffect(() => {
    if (!storyId || !signedIn) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/stories?id=" + encodeURIComponent(storyId), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("This story is unavailable.");
        const { story: voice } = await response.json() as { story: Voice };
        if (voice.mine) throw new Error("Readers can request to connect with you from this story after you enable requests.");
        const photo = voice.usePhotoAsPortrait ? voice.photos?.[0] : undefined;
        if (!controller.signal.aborted) setStory({
          id: voice.id, title: voice.title, name: voice.name, flag: voice.flag, place: voice.place,
          portrait: photo?.portraitSrc ?? photo?.src ?? null, excerpt: voice.quote,
        });
      } catch (error) {
        if (!controller.signal.aborted) setStoryIssue(chatErrorMessage(error));
      }
    })();
    return () => controller.abort();
  }, [signedIn, storyId]);

  const requests = inbox?.connections.filter(item => item.status === "pending") ?? [];
  const chats = inbox?.connections.filter(item => item.status !== "pending") ?? [];
  const currentSection = chats.some(chat => chat.id === selected) ? "chats" : section;
  const list = currentSection === "chats" ? chats : requests;
  const active = storyId ? null : list.find(item => item.id === selected) ?? list[0] ?? null;
  const context = storyId ? story : active?.story;
  const incoming = requests.filter(item => !item.outgoing).length;
  const loginQuery = "?" + new URLSearchParams(storyId ? { next: "connections", story: storyId } : { next: "connections" });

  function clearStory() {
    if (!storyId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("story");
    history.replaceState(history.state, "", url);
    setStoryId("");
    setStory(null);
    setStoryIssue("");
  }

  function select(item: Connection) {
    clearStory();
    setSelected(item.id);
    setOpen(true);
    setShowStory(false);
    setIssue("");
    if (menu.current) menu.current.open = false;
  }

  function selectSection(next: Section) {
    clearStory();
    setSection(next);
    setSelected("");
    setOpen(false);
    setIssue("");
    setShowStory(false);
  }

  async function mutate(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      setIssue(chatErrorMessage(error));
      if (error instanceof ChatError && (error.status === 401 || error.status === 404)) refresh();
    } finally {
      setBusy(false);
    }
  }

  function request() {
    if (!story) return;
    void mutate(async () => {
      const { id } = await requestChat(story.id);
      const next = await loadInbox();
      const item = next?.connections.find(connection => connection.id === id);
      setSection(item?.status === "accepted" ? "chats" : "requests");
      if (item) {
        select(item);
        if (item.outgoing && item.status === "pending") setNotice("Connection request sent.");
      } else {
        clearStory();
        setSelected(id);
        setOpen(true);
      }
    });
  }

  function act(action: ConnectionAction) {
    if (!active) return;
    void mutate(async () => {
      await changeConnection(active.id, action);
      setConfirm(null);
      if (action === "accept") {
        setSection("chats");
        select(active);
        setNotice("Connection accepted.");
      } else if (action === "end") {
        setNotice("Conversation ended.");
      } else {
        setOpen(false);
        setSelected("");
        setNotice(action === "block" ? "Connection blocked." : action === "withdraw" ? "Request withdrawn." : "Request declined.");
      }
      await loadInbox();
    });
  }

  function updatePreference() {
    if (!inbox) return;
    void mutate(async () => {
      await setChatPreference(!inbox.acceptsRequests);
      await loadInbox();
    });
  }

  return <div className="connections-page">
    <header className="site-header">
      <div className="wrap connections-header">
        <a href="/" aria-label="RYE home"><Brand /></a>
        <a href="/#atlas" className="btn outline"><Globe2 size={16} aria-hidden="true" /> The Atlas</a>
      </div>
    </header>
    <main className="wrap connections-main">
      <div className="connections-heading">
        <Bloom />
        <h1>Connections</h1>
      </div>
      <div className="connections-desk" data-signed-in={signedIn} data-open={open || (signedIn && Boolean(storyId))} data-story-open={showStory}>
        <aside className="connection-inbox" aria-label="Your connections">
          <div className="connection-tabs" role="group" aria-label="Connection inbox">
            <button type="button" onClick={() => selectSection("chats")} aria-pressed={currentSection === "chats"}>Chats</button>
            <button type="button" onClick={() => selectSection("requests")} aria-pressed={currentSection === "requests"}>
              Requests{incoming > 0 && <span aria-label={incoming + " incoming"}>{incoming}</span>}
            </button>
          </div>
          <div className="connection-list">
            {list.map(item => (
              <button className="connection-contact" type="button" key={item.id} onClick={() => select(item)}
                aria-pressed={active?.id === item.id}>
                <ChatAvatar name={item.name} portrait={item.portrait} />
                <span><strong>{item.name}</strong><small>{item.status === "accepted" ? item.story?.title || "Conversation" : connectionLabel(item)}</small></span>
              </button>
            ))}
            {list.length === 0 && <p className="connection-list-empty">{currentSection === "chats" ? "No conversations yet" : "No requests yet"}</p>}
          </div>
          {inbox && <div className="connection-settings">
            <label>
              <Settings2 size={17} aria-hidden="true" />
              <span>Allow requests</span>
              <input type="checkbox" role="switch" checked={inbox.acceptsRequests} onChange={updatePreference} disabled={busy} />
            </label>
            <p>Let signed-in readers send a request from your published stories.</p>
          </div>}
        </aside>

        <section className="connection-thread-panel" aria-label="Conversation">
          {signedOut ? (
            <div className="connection-empty">
              <LockKeyhole size={25} aria-hidden="true" />
              <h2>Log in to connect.</h2>
              <p>When you resonate with a story, send its author a connection request. Chat opens once they accept.</p>
              <div className="connection-actions">
                <a href={"/login/" + loginQuery} className="btn dark">Log in</a>
                <a href={"/signup/" + loginQuery} className="btn outline">Sign up</a>
              </div>
            </div>
          ) : !inbox ? (
            <div className="connection-empty" role="status">
              <MessageCircle size={25} aria-hidden="true" />
              <h2>{inboxIssue ? "Couldn’t open Connections" : "Opening Connections…"}</h2>
              {inboxIssue && <button className="btn outline" type="button" onClick={refresh}>Try again</button>}
            </div>
          ) : storyId ? (
            <div className="chat-thread connection-request">
              <FlagBackdrop flag={story?.flag ?? "rye"} />
              <div className="chat-state-card">
                <button className="text-link mobile-chat-back" type="button" onClick={() => { clearStory(); setOpen(false); }}>Back</button>
                {story ? <>
                  <ChatAvatar name={story.name} portrait={story.portrait} />
                  <h2>Connect with {story.name}?</h2>
                  <p>Your display name goes with the request. You can message each other after {story.name} accepts.</p>
                  <button className="btn dark" type="button" disabled={busy} onClick={request}><Send size={16} aria-hidden="true" /> Send request</button>
                </> : <p role="status">{storyIssue || "Opening the story…"}</p>}
              </div>
            </div>
          ) : active ? (
            <>
              <div className="chat-person">
                <button className="text-link mobile-chat-back" type="button" onClick={() => setOpen(false)}>Back</button>
                <ChatAvatar name={active.name} portrait={active.portrait} />
                <div className="chat-person-name"><h2>{active.name}</h2><p><LockKeyhole size={13} aria-hidden="true" />{connectionLabel(active)}</p></div>
                {context && <button className="btn outline chat-show-story" type="button" aria-expanded={showStory}
                  onClick={() => setShowStory(value => !value)}>Story</button>}
                <details className="connection-options" ref={menu}>
                  <summary className="round" aria-label="Conversation options"><MoreHorizontal size={20} /></summary>
                  <div>
                    {active.status === "accepted" && <button type="button" disabled={busy} onClick={() => setConfirm("end")}>End chat</button>}
                    <button type="button" disabled={busy} onClick={() => setConfirm("block")}>Block</button>
                  </div>
                </details>
              </div>
              {active.status === "pending" ? (
                <div className="chat-thread connection-request">
                  <FlagBackdrop flag={active.story?.flag ?? "rye"} />
                  <div className="chat-state-card">
                    <LockKeyhole size={25} aria-hidden="true" />
                    <h2>{active.outgoing ? "Request sent" : active.name + " wants to connect"}</h2>
                    <p>{active.outgoing ? "You can start chatting once your request is accepted." : "Accept to open a private conversation."}</p>
                    <div className="connection-actions">
                      {active.outgoing ? <button className="btn outline" type="button" disabled={busy} onClick={() => act("withdraw")}>Withdraw request</button> :
                        <>
                          <button className="btn dark" type="button" disabled={busy} onClick={() => act("accept")}>Accept</button>
                          <button className="btn outline" type="button" disabled={busy} onClick={() => act("decline")}>Decline</button>
                        </>}
                    </div>
                  </div>
                </div>
              ) : <ChatMessages connection={active} key={active.id} refresh={refresh} />}
            </>
          ) : (
            <div className="connection-empty">
              <MessageCircle size={25} aria-hidden="true" />
              <h2>{currentSection === "chats" ? "Start with a story." : "No connection requests."}</h2>
              <p>{currentSection === "chats" ? "Find a story that stays with you, then ask its author to connect." : "Incoming and outgoing requests will appear here."}</p>
              <a href="/#atlas" className="btn outline">Explore the Atlas</a>
            </div>
          )}
          {issue && !confirm && <p className="chat-inline-issue" role="alert">{issue}</p>}
        </section>
        {context ? <StoryContext story={context} /> : (
          <aside className="connection-context connection-context-empty" aria-label="Story details">
            <BookOpen size={24} aria-hidden="true" />
            <p>The story that started your conversation will appear here.</p>
          </aside>
        )}
      </div>
      {notice && <p className="connection-notice" role="status">{notice}</p>}
      {inbox && inboxIssue && <p className="connection-notice" role="status">{inboxIssue} <button type="button" className="text-link" onClick={refresh}>Retry</button></p>}
    </main>
    {confirm && active && <Dialog close={() => { if (!busy) setConfirm(null); }} titleId="connection-confirm">
      <h2 id="connection-confirm">{confirm === "end" ? "End this chat?" : "Block this connection?"}</h2>
      <p className="sheet-intro">{confirm === "end" ? "Both of you can still read your previous messages. This closes the conversation to new messages." :
        "This hides the conversation and stops new messages and requests between both accounts."}</p>
      <div className="connection-actions">
        <button className="btn dark" type="button" onClick={() => act(confirm)} disabled={busy}>{confirm === "end" ? "End chat" : "Block connection"}</button>
        <button className="btn outline" type="button" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
      </div>
      {issue && <p className="chat-inline-issue" role="alert">{issue}</p>}
    </Dialog>}
  </div>;
}
