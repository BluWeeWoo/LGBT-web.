"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Feather,
  Globe2,
  Hand,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  flagThemes,
  samples,
  topics,
  type Topic,
  type Voice,
} from "../lib/voices";
import { Brand, Bloom } from "./Brand";
import { regionCenter } from "../lib/regions";
import Globe from "./Globe";
import { About, Dialog, FlagChip, Reader, ShareForm } from "./Dialogs";
import { Face, Postcard } from "./VoiceArt";

const slots = [
  [73, 57],
  [17, 49],
  [68, 13],
  [35, 18],
  [88, 32],
  [42, 82],
];
const baseColor = "#f6ecdf";
const softFlag = (hex: string) => {
  const h = hex.slice(1),
    b = baseColor.slice(1);
  return (
    "rgb(" +
    [0, 2, 4]
      .map((i) =>
        Math.round(
          parseInt(h.slice(i, i + 2), 16) * 0.32 +
            parseInt(b.slice(i, i + 2), 16) * 0.68,
        ),
      )
      .join(",") +
    ")"
  );
};
function backgroundFor(voice: Voice) {
  const colors = flagThemes[voice.flag].colors.map(softFlag);
  return (
    "linear-gradient(155deg," +
    colors
      .map((c, i) => c + " " + (i * 100) / (colors.length - 1) + "%")
      .join(",") +
    ")"
  );
}
const shortName = (voice: Voice) =>
  voice.name.length > 23 ? voice.name.slice(0, 22) + "…" : voice.name;

function frontPosition(
  center: [number, number] | undefined,
  longitude: number,
) {
  if (!center) return { left: "60%", top: "48%" };
  const rad = Math.PI / 180;
  const lat = center[1] * rad,
    angle = (center[0] - longitude) * rad,
    tilt = 22 * rad;
  const x = Math.cos(lat) * Math.sin(angle);
  const y =
    Math.cos(lat) * Math.cos(angle) * Math.sin(tilt) -
    Math.sin(lat) * Math.cos(tilt);
  const roll = -9 * rad;
  const dx = x * Math.cos(roll) - y * Math.sin(roll);
  const dy = x * Math.sin(roll) + y * Math.cos(roll);
  return { left: "calc(50% + " + 48 * dx + "cqh)", top: 48 + 48 * dy + "%" };
}

export default function Atlas({ signedIn }: { signedIn: boolean }) {
  const [community, setCommunity] = useState<Voice[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState(""),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("mara"),
    [chosen, setChosen] = useState(false);
  const [filter, setFilter] = useState<Topic | "All themes">("All themes"),
    [shown, setShown] = useState(3);
  const [hash, setHash] = useState(""),
    [nav, setNav] = useState("atlas"),
    [note, setNote] = useState("");
  const [remoteStory, setRemoteStory] = useState<Voice | null>(null),
    [deepError, setDeepError] = useState("");
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const collection = useRef<HTMLElement>(null);
  const hasModalHistory = useRef(false);
  const voices = [...community, ...samples];
  const index = Math.max(
      0,
      voices.findIndex((v) => v.id === selected),
    ),
    active = voices[index];
  const center = active.center || regionCenter(active.place);
  const longitude = chosen && center ? center[0] - 15 : 58;
  const pageStart = Math.floor(index / slots.length) * slots.length;
  const group = voices.slice(pageStart, pageStart + slots.length);
  const filtered = voices.filter(
    (v) => filter === "All themes" || v.topic === filter,
  );
  const storyId = hash.startsWith("#story/") ? hash.slice(7) : "";
  const reader = storyId
    ? voices.find((v) => v.id === storyId) ||
      (remoteStory?.id === storyId ? remoteStory : null)
    : null;
  const inDialog = Boolean(storyId) || hash === "#share" || hash === "#about";

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
    if (
      new URLSearchParams(window.location.search).get("share") === "1" &&
      signedIn
    ) {
      history.replaceState(null, "", "/#share");
      setHash("#share");
    }
    window.addEventListener("hashchange", change);
    window.addEventListener("popstate", change);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("popstate", change);
    };
  }, [signedIn]);
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
    if (!signedIn) {
      window.open("/signin-with-chatgpt?return_to=%2F%3Fshare%3D1", "_top");
      return;
    }
    open("#share");
  }
  function choose(voice: Voice) {
    setSelected(voice.id);
    setChosen(true);
  }
  function step(by: number) {
    choose(voices[(index + by + voices.length) % voices.length]);
  }
  function published(voice: Voice) {
    setCommunity((old) => [voice, ...old.filter((v) => v.id !== voice.id)]);
    choose(voice);
    setFilter("All themes");
    setShown(3);
    setNote("Your story is in the atlas.");
    open("#story/" + voice.id);
  }
  function remove(id: string) {
    setCommunity((old) => old.filter((v) => v.id !== id));
    setRemoteStory(null);
    if (selected === id) {
      setSelected("mara");
      setChosen(false);
    }
    setNote("Your story has been removed.");
  }
  const showMore = () => {
    if (shown >= filtered.length && cursor) void load(cursor);
    setShown((n) => n + 6);
  };
  const serial = (i: number) => String(i).padStart(2, "0");
  return (
    <div className="site" id="top">
      <a className="skip" href="#stories">
        Skip to stories
      </a>
      <header className="site-header">
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
        <section
          id="atlas"
          className="atlas-section"
          aria-label="The story atlas"
        >
          <div
            aria-hidden="true"
            className={
              "flag-wash " + (chosen && active.flag !== "rye" ? "visible" : "")
            }
            key={chosen ? active.flag : "initial"}
            style={{ backgroundImage: backgroundFor(active) }}
          />
          <div className="wrap atlas-grid">
            <div className="atlas-copy">
              <p className="eyebrow kicker">
                <span className="kicker-icon">
                  <Globe2 size={13} />
                </span>
                THE STORY ATLAS
              </p>
              <h1>
                A world of
                <br />
                <em>stories.</em>
                <span aria-hidden="true" className="title-star">
                  ✳
                </span>
              </h1>
              <p className="lede">
                Explore LGBTQ+ lives around the world, one personal story at a
                time.
              </p>
              <div
                className="featured-voice"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="feature-meta">
                  <span className="voice-dot" />
                  <strong>{active.name}</strong>
                  <span className="meta-divider">/</span>
                  <span>{active.place || "Community voice"}</span>
                  {chosen && active.flag !== "rye" && (
                    <FlagChip flag={active.flag} />
                  )}
                </div>
                <blockquote key={active.id}>“{active.quote}”</blockquote>
                <button
                  className="story-link"
                  type="button"
                  onClick={() => open("#story/" + active.id)}
                >
                  Read{" "}
                  {active.name === "Anonymous" || active.name.length > 20
                    ? "the story"
                    : active.name + "’s story"}
                  <ArrowUpRight size={16} />
                </button>
                {active.sample && (
                  <span className="sample-label">Sample story</span>
                )}
              </div>
            </div>
            <div
              className="atlas-visual"
              role="region"
              aria-roledescription="carousel"
              aria-label="Storyteller globe"
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  step(e.key === "ArrowLeft" ? -1 : 1);
                }
              }}
            >
              <div
                className="globe-stage"
                onTouchStart={(e) => {
                  swipe.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                  suppressClick.current = false;
                }}
                onTouchCancel={() => {
                  swipe.current = null;
                }}
                onTouchEnd={(e) => {
                  if (!swipe.current) return;
                  const dx = e.changedTouches[0].clientX - swipe.current.x,
                    dy = e.changedTouches[0].clientY - swipe.current.y;
                  swipe.current = null;
                  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                    suppressClick.current = true;
                    step(dx < 0 ? 1 : -1);
                    setTimeout(() => {
                      suppressClick.current = false;
                    }, 300);
                  }
                }}
              >
                <span className="orbit orbit-back" aria-hidden="true" />
                <span className="orbit orbit-side" aria-hidden="true" />
                <span className="world-shadow" aria-hidden="true" />
                <Globe longitude={longitude} />
                <span className="orbit-dot orbit-dot-a" aria-hidden="true" />
                <span className="orbit-dot orbit-dot-b" aria-hidden="true" />
                <span className="spark spark-a" aria-hidden="true">
                  ✦
                </span>
                <span className="spark spark-b" aria-hidden="true">
                  ✧
                </span>
                <span className="spark spark-c" aria-hidden="true">
                  +
                </span>
                {group.map((v, i) => (
                  <button
                    type="button"
                    className={
                      "voice-pin pin-" +
                      i +
                      (v.id === active.id ? " active" : "")
                    }
                    key={v.id}
                    style={
                      chosen && v.id === active.id
                        ? frontPosition(center, longitude)
                        : { left: slots[i][0] + "%", top: slots[i][1] + "%" }
                    }
                    aria-label={
                      "Select " + v.name + (v.place ? " from " + v.place : "")
                    }
                    aria-pressed={v.id === active.id}
                    onClick={() => {
                      if (!suppressClick.current) choose(v);
                    }}
                  >
                    <span className="pin-photo">
                      <Face voice={v} />
                    </span>
                    <span className="pin-tag">
                      <span className="pin-tag-dot" />
                      {shortName(v)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="globe-toolbar">
                <span className="explore-hint">
                  <Hand size={14} strokeWidth={1.6} />
                  Select a portrait to explore
                </span>
                <span className="slide-index">
                  <strong>{serial(index + 1)}</strong>
                  <span>/</span>
                  {serial(voices.length)}
                </span>
                <div className="slide-buttons">
                  <button
                    type="button"
                    className="round"
                    aria-label="Previous voice"
                    onClick={() => step(-1)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="round"
                    aria-label="Next voice"
                    onClick={() => step(1)}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="stories" className="collection" ref={collection}>
          <div className="wrap">
            <div className="collection-heading">
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
      {hash === "#share" &&
        (signedIn ? (
          <ShareForm close={close} published={published} />
        ) : (
          <Dialog close={close} titleId="dialog-title">
            <h2 id="dialog-title">Share your story.</h2>
            <p className="sheet-intro">
              Sign in to publish under the name you choose and manage your story
              later.
            </p>
            <button className="btn dark" type="button" onClick={share}>
              Continue to sign in
              <ArrowRight size={16} />
            </button>
          </Dialog>
        ))}
      {storyId &&
        (reader ? (
          <Reader
            key={reader.id}
            story={reader}
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
  );
}
