"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, Feather, SlidersHorizontal, X } from "lucide-react";
import { samples, topics, type Topic, type Voice } from "../lib/voices";
import { Brand, Bloom } from "./Brand";
import FeaturedPeople from "./FeaturedPeople";
import { About, Reader } from "./Dialogs";
import { Dialog } from "./Dialog";
import { ShareForm } from "./ShareForm";
import { Postcard } from "./VoiceArt";
import AtlasWelcome, { type IntroPhase } from "./AtlasWelcome";
import { finishGuide, followSession, leaveDemo, readDemo, startGuide } from "../lib/demo-session";
import type { StorySession } from "../lib/story-access";

type AtlasProps = { initialSession: StorySession; initialWelcome: boolean; publishLogin: string };

export default function Atlas({ initialSession, initialWelcome, publishLogin }: AtlasProps) {
  const [session, setSession] = useState(initialSession);
  const [intro, setIntro] = useState<IntroPhase>(initialWelcome ? "welcome" : "idle");
  const finishWelcome = useCallback(() => {
    startGuide();
    setIntro("guide");
  }, []);
  useLayoutEffect(() => {
    const demo = session.loggedIn ? readDemo() : null;
    setIntro(demo?.welcome ? "welcome" : demo?.guide ? "guide" : "idle");
    if (demo?.welcome || demo?.guide) window.scrollTo({ top: 0, behavior: "instant" });
    const url = new URL(window.location.href);
    if (url.searchParams.has("welcome")) {
      url.searchParams.delete("welcome");
      history.replaceState(history.state, "", url);
    }
  }, [session.loggedIn]);
  useEffect(() => {
    // Recheck the cookie on a history restore or after login/logout in another tab.
    let pending: AbortController | undefined;
    async function sync() {
      if (document.hidden) return;
      pending?.abort();
      const request = new AbortController();
      pending = request;
      try {
        const response = await fetch("/api/demo-session", { cache: "no-store", signal: request.signal });
        if (response.ok) {
          const current: StorySession = await response.json();
          if (!request.signal.aborted) setSession(current);
        }
      } catch { /* A write always rechecks both login and ownership on the server. */ }
    }
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      pending?.abort();
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const [community, setCommunity] = useState<Voice[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState(""),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("mara");
  const [filter, setFilter] = useState<Topic | "All themes">("All themes"),
    [shown, setShown] = useState(3);
  const [hash, setHash] = useState(""),
    [nav, setNav] = useState("atlas"),
    [note, setNote] = useState("");
  const [remoteStory, setRemoteStory] = useState<Voice | null>(null),
    [deepError, setDeepError] = useState("");
  const header = useRef<HTMLElement>(null);
  const collection = useRef<HTMLElement>(null);
  const hasModalHistory = useRef(false);
  const voices = [...community, ...samples];
  const filtered = voices.filter(
    (v) => filter === "All themes" || v.topic === filter,
  );
  const storyId = hash.startsWith("#story/") ? hash.slice(7) : "";
  const reader = storyId
    ? voices.find((v) => v.id === storyId) ||
      (remoteStory?.id === storyId ? remoteStory : null)
    : null;
  const inDialog = Boolean(storyId) || hash === "#share" || hash === "#about";

  useLayoutEffect(() => {
    const masthead = header.current;
    const page = masthead?.parentElement;
    if (!masthead || !page) return;
    const measure = () => page.style.setProperty("--masthead-height", masthead.getBoundingClientRect().height + "px");
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(masthead);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const section = collection.current;
    if (!section || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-story-reveal", "shown");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.02 });
    for (const item of section.querySelectorAll<HTMLElement>("[data-story-reveal]")) {
      if (item.dataset.storyReveal === "shown") continue;
      // Leave already visible content in place on initial load and history restores.
      const bounds = item.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) {
        item.dataset.storyReveal = "shown";
      } else {
        item.dataset.storyReveal = "pending";
        observer.observe(item);
      }
    }
    return () => observer.disconnect();
  }, [community, filter, shown]);

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    setArchiveError("");
    try {
      const res = await fetch(
        "/api/stories" + (next ? "?cursor=" + encodeURIComponent(next) : ""),
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        stories: Voice[];
        cursor: string | null;
        error?: string;
      };
      if (!res.ok) throw Error(data.error);
      setCommunity((old) => {
        const list: Voice[] = next ? [...old, ...data.stories] : data.stories;
        return [...new Map(list.map((v) => [v.id, v])).values()];
      });
      setCursor(data.cursor);
    } catch {
      setArchiveError("Community stories couldn’t load.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const change = () => setHash(window.location.hash);
    change();
    if (new URLSearchParams(window.location.search).get("share") === "1") {
      history.replaceState(null, "", "/#share");
      setHash("#share");
    }
    window.addEventListener("hashchange", change);
    window.addEventListener("popstate", change);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("popstate", change);
    };
  }, []);
  useEffect(() => {
    const element = collection.current;
    if (!element) return;
    const onScroll = () =>
      setNav(
        element.getBoundingClientRect().top < innerHeight * 0.5
          ? "stories"
          : "atlas",
      );
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!storyId || reader) return;
    let valid = true;
    setDeepError("");
    fetch("/api/stories?id=" + encodeURIComponent(storyId))
      .then(async (res) => {
        const data = (await res.json()) as { story: Voice; error?: string };
        if (!res.ok) throw Error(data.error);
        if (valid) setRemoteStory(data.story);
      })
      .catch(() => {
        if (valid)
          setDeepError("This story is unavailable. It may have been removed.");
      });
    return () => {
      valid = false;
    };
  }, [storyId, reader]);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 6000);
    return () => clearTimeout(id);
  }, [note]);

  function open(route: string) {
    if (inDialog) history.replaceState(null, "", route);
    else {
      history.pushState(null, "", route);
      hasModalHistory.current = true;
    }
    setHash(route);
  }
  function close() {
    if (hasModalHistory.current) {
      hasModalHistory.current = false;
      history.back();
    } else {
      history.replaceState(null, "", location.pathname);
      setHash("");
    }
  }
  function share() {
    if (intro === "guide") {
      finishGuide("skipped");
      setIntro("idle");
    }
    if (session.loggedIn && !session.platformSignedIn) {
      window.open(publishLogin, "_top");
    } else {
      open("#share");
    }
  }
  async function logOut() {
    try {
      followSession(await leaveDemo());
    } catch {
      setNote("Log out could not be completed. Please try again.");
    }
  }
  function published(voice: Voice) {
    setCommunity((old) => [voice, ...old.filter((v) => v.id !== voice.id)]);
    setSelected(voice.id);
    setFilter("All themes");
    setShown(3);
    setNote("Your story is in the atlas.");
    open("#story/" + voice.id);
  }
  function remove(id: string) {
    setCommunity((old) => old.filter((v) => v.id !== id));
    setRemoteStory(null);
    if (selected === id) setSelected("mara");
    setNote("Your story has been removed.");
  }
  const showMore = () => {
    if (shown >= filtered.length && cursor) void load(cursor);
    setShown((n) => n + 6);
  };
  return (
    <>
    <div className="site" id="top" inert={intro === "welcome"}>
      <a className="skip" href="#stories">
        Skip to stories
      </a>
      <header className="site-header" ref={header}>
        <div className="wrap header-inner">
          <a
            className="logo-link"
            href="#top"
            aria-label="RYE, Raise Your Equality home"
          >
            <Brand />
          </a>
          <nav aria-label="Main navigation">
            <a
              href="#atlas"
              className={nav === "atlas" && hash !== "#about" ? "nav-on" : ""}
            >
              The atlas
            </a>
            <a
              href="#stories"
              className={nav === "stories" && hash !== "#about" ? "nav-on" : ""}
            >
              Stories
            </a>
            <button
              type="button"
              onClick={() => open("#about")}
              className={hash === "#about" ? "nav-on" : ""}
            >
              About RYE
            </button>
            {session.loggedIn
              ? <button type="button" onClick={logOut}>Log out</button>
              : <a href="/login">Log in</a>}
          </nav>
          <button
            type="button"
            className="btn dark header-share"
            onClick={share}
          >
            <Feather size={16} />
            <span>Share your story</span>
          </button>
        </div>
      </header>
      <main>
        <FeaturedPeople voices={voices} selectedId={selected} select={setSelected} read={id=>open("#story/"+id)}
          arriving={intro === "welcome"} onArrived={finishWelcome}/>
        <section id="stories" className="collection" ref={collection}>
          <div className="wrap">
            <div className="collection-heading" data-story-reveal="">
              <div>
                <p className="eyebrow">
                  <span className="little-rule" />
                  THE COLLECTION
                </p>
                <h2>
                  From the <em>archive.</em>
                </h2>
              </div>
              <label className="theme-filter">
                <SlidersHorizontal size={14} />
                <span className="sr-only">Filter stories by theme</span>
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as Topic | "All themes");
                    setShown(3);
                  }}
                >
                  <option>All themes</option>
                  {topics.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            <div className="cards">
              {filtered.slice(0, shown).map((v) => (
                <button
                  className="story-card"
                  data-story-reveal=""
                  key={v.id}
                  type="button"
                  onClick={() => open("#story/" + v.id)}
                  aria-label={"Read " + v.title + " by " + v.name}
                >
                  <Postcard voice={v} />
                  <span className="card-caption">
                    <span className="card-topline">
                      {v.topic}
                      <span>·</span>
                      {v.sample ? "Sample story" : "Community story"}
                    </span>
                    <span className="card-title">{v.title}</span>
                    <span className="card-bottom">
                      <span>By {v.name}</span>
                      <ArrowUpRight size={17} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {archiveError && (
              <p role="status" className="archive-alert">
                {archiveError}{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => void load()}
                >
                  Try again
                </button>
              </p>
            )}
            {(shown < filtered.length || cursor) && (
              <div className="load-wrap">
                <button
                  className="btn outline"
                  type="button"
                  disabled={loading}
                  onClick={showMore}
                >
                  {loading ? "Loading…" : "More stories"}
                  <ArrowDown size={15} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section className="join">
          <div className="wrap join-inner">
            <Bloom className="join-bloom" />
            <div>
              <h2>
                Your story <em>deserves to be heard.</em>
              </h2>
              <p>Share a moment from your life under the name you choose.</p>
            </div>
            <button type="button" className="btn light" onClick={share}>
              Share your story
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      </main>
      <footer className="wrap footer">
        <a href="#top" aria-label="RYE home">
          <Brand />
        </a>
        <button
          type="button"
          className="text-link"
          onClick={() => open("#about")}
        >
          About RYE
        </button>
        <a className="back-top" href="#top">
          Back to top
          <ArrowUp size={14} />
        </a>
      </footer>
      {hash === "#about" && <About close={close} share={share} />}
      {hash === "#share" && intro === "idle" &&
        (session.loggedIn && session.platformSignedIn ? (
          <ShareForm close={close} published={published} />
        ) : (
          <Dialog close={close} titleId="dialog-title" variant="compose" label="Share a voice">
            <div className="sign-in-letter">
              <h2 id="dialog-title">{session.loggedIn ? <>Share your <em>story.</em></> : <>Log in to <em>write.</em></>}</h2>
              <p className="sheet-intro">
                {session.loggedIn
                  ? "Continue with ChatGPT to publish and manage your story under the display name you choose."
                  : "Log in or sign up to write your own story. You can read the atlas anytime."}
              </p>
              <div className="dialog-actions">
                {session.loggedIn
                  ? <a className="btn dark" href={publishLogin} target="_top">Continue with ChatGPT</a>
                  : <><a className="btn dark" href="/login?next=share">Log in</a>
                    <a className="text-link" href="/signup?next=share">Sign up</a></>}
              </div>
            </div>
          </Dialog>
        ))}
      {storyId &&
        (reader ? (
          <Reader
            key={reader.id}
            story={session.loggedIn && session.platformSignedIn ? reader : { ...reader, mine: false }}
            close={close}
            onRemove={remove}
          />
        ) : (
          <Dialog close={close} titleId="dialog-title">
            <h2 id="dialog-title">
              {deepError ? "Story unavailable" : "Opening story…"}
            </h2>
            <p>{deepError}</p>
          </Dialog>
        ))}
      {note && (
        <div role="status" className="toast">
          <Check size={16} />
          {note}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNote("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
    <AtlasWelcome phase={intro} setPhase={setIntro} />
    </>
  );
}
