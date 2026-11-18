"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Feather,
  Globe2,
  X,
} from "lucide-react";
import {
  excerpt,
  flagThemes,
  readTime,
  topics,
  type Flag,
  type Topic,
  type Voice,
} from "../lib/voices";

import { Face } from "./VoiceArt";
import { regionNames } from "../lib/regions";

export function Dialog({
  titleId,
  children,
  close,
}: {
  titleId: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      el.close();
      document.body.style.overflow = previous;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          close();
      }}
    >
      <button
        ref={closeButton}
        type="button"
        className="round sheet-close"
        onClick={close}
        aria-label="Close dialog"
      >
        <X size={19} />
      </button>
      {children}
    </dialog>
  );
}

export function FlagChip({ flag }: { flag: Flag }) {
  const theme = flagThemes[flag];
  return (
    <span className="flag-chip">
      <i
        aria-hidden="true"
        style={{
          background:
            flag === "rye"
              ? "#9067c6"
              : "linear-gradient(to bottom," +
                theme.colors
                  .map(
                    (c, i) =>
                      c +
                      " " +
                      (100 * i) / theme.colors.length +
                      "% " +
                      (100 * (i + 1)) / theme.colors.length +
                      "%",
                  )
                  .join(",") +
                ")",
        }}
      />
      {theme.name}
    </span>
  );
}

export function StoryText({
  story,
  preview = false,
}: {
  story: Voice;
  preview?: boolean;
}) {
  return (
    <article className="reader">
      <p className="eyebrow">
        <span className="little-rule" />
        {preview
          ? "STORY PREVIEW"
          : story.sample
            ? "ILLUSTRATIVE STORY"
            : "COMMUNITY STORY"}
      </p>
      <h2 id="dialog-title">{story.title}</h2>
      <div className="reader-byline">
        <span className="reader-face">
          <Face voice={story} />
        </span>
        <span>
          <strong>{story.name}</strong>
          <small>
            {story.place || "Community voice"} <span aria-hidden="true">·</span>{" "}
            {readTime(story.body)} min read
          </small>
        </span>
      </div>
      <div className="reader-tags">
        <span className="topic-tag">{story.topic}</span>
        <FlagChip flag={story.flag} />
      </div>
      <div className="prose">
        {story.body
          .split(/\n+/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </div>
      {story.sample && (
        <p className="sample-note">
          This fictional story and illustrated portrait are part of RYE’s sample
          collection.
        </p>
      )}
    </article>
  );
}

export function Reader({
  story,
  close,
  onRemove,
}: {
  story: Voice;
  close: () => void;
  onRemove: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/stories?id=" + encodeURIComponent(story.id),
        { method: "DELETE" },
      );
      const result = (await response.json()) as {
        error?: string;
        story: Voice;
      };
      if (!response.ok)
        throw Error(result.error || "Could not remove the story.");
      onRemove(story.id);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the story.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog titleId="dialog-title" close={close}>
      <StoryText story={story} />
      <div className="dialog-actions">
        <button type="button" className="btn dark" onClick={close}>
          <ArrowLeft size={15} />
          Back to the atlas
        </button>
        {story.mine && !confirm && (
          <button
            className="text-link"
            type="button"
            onClick={() => setConfirm(true)}
          >
            Remove my story
          </button>
        )}
      </div>
      {confirm && (
        <div className="confirm-box">
          <p>Remove your story from the atlas and collection?</p>
          <button
            type="button"
            className="btn dark"
            disabled={busy}
            onClick={remove}
          >
            Remove story
          </button>
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Keep story
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Dialog>
  );
}

export function ShareForm({
  close,
  published,
}: {
  close: () => void;
  published: (s: Voice) => void;
}) {
  const [name, setName] = useState(""),
    [place, setPlace] = useState(""),
    [title, setTitle] = useState(""),
    [body, setBody] = useState("");
  const [flag, setFlag] = useState<Flag>("rye"),
    [topic, setTopic] = useState<Topic>("Belonging");
  const [preview, setPreview] = useState(false),
    [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submissionId = useRef("");
  const content = useRef<HTMLDivElement>(null);
  const data: Voice = {
    id: "preview",
    name: name.trim() || "Anonymous",
    place: place.trim(),
    title: title.trim(),
    body: body.trim(),
    quote: excerpt(body),
    flag,
    topic,
    sample: false,
  };
  function showPreview(event: FormEvent) {
    event.preventDefault();
    if (!data.title || data.body.length < 20) {
      setError("Add a title and at least 20 characters of story text.");
      return;
    }
    setError("");
    setPreview(true);
  }
  useEffect(() => {
    const dialog = content.current?.closest("dialog");
    if (dialog) dialog.scrollTop = 0;
    if (preview) content.current?.focus({ preventScroll: true });
  }, [preview]);
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!submissionId.current) submissionId.current = crypto.randomUUID();
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, id: submissionId.current, consent }),
      });
      const result = (await response.json()) as {
        error?: string;
        story: Voice;
      };
      if (!response.ok)
        throw Error(result.error || "Your story could not be published.");
      published(result.story);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Please try again. Your story is still here.",
      );
      setBusy(false);
    }
  }
  return (
    <Dialog
      titleId="dialog-title"
      close={() => {
        if (!busy) close();
      }}
    >
      <div ref={content} tabIndex={-1}>
        {preview ? (
          <>
            <StoryText story={data} preview />
            <form onSubmit={publish}>
              <label className="consent">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I want this story and the details shown above to be visible to
                people who can access RYE.
              </label>
              <div className="dialog-actions">
                <button
                  type="submit"
                  className="btn dark"
                  disabled={busy || !consent}
                >
                  {busy ? "Publishing…" : "Publish my story"}
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    setPreview(false);
                    setConsent(false);
                  }}
                >
                  Back to editing
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow">
              <Feather size={14} />
              SHARE A VOICE
            </p>
            <h2 id="dialog-title">
              Share your story<span className="violet">.</span>
            </h2>
            <p className="sheet-intro">
              Tell it in your own words. You’ll see a preview before you
              publish.
            </p>
            <form onSubmit={showPreview} className="story-form">
              <div className="form-row">
                <label>
                  Display name <small>(optional)</small>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name or pen name"
                    maxLength={55}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Country or region <small>(optional)</small>
                  <input
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="Where you’re writing from"
                    maxLength={65}
                    autoComplete="off"
                    list="region-names"
                  />
                  <datalist id="region-names">
                    {regionNames.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </label>
              </div>
              <label>
                Story title
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your story a title"
                  maxLength={100}
                />
              </label>
              <label>
                Your story
                <textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Start with a moment you remember…"
                  minLength={20}
                  maxLength={6000}
                  rows={6}
                />
              </label>
              <small className="char-count">
                {body.length.toLocaleString()} / 6,000
              </small>
              <div className="form-row">
                <label>
                  Story theme
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as Topic)}
                  >
                    {topics.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Atlas colors
                  <select
                    value={flag}
                    onChange={(e) => setFlag(e.target.value as Flag)}
                  >
                    {Object.entries(flagThemes).map(([v, f]) => (
                      <option key={v} value={v}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="field-hint">
                Choose a Pride flag or keep RYE’s colors. Leave the name blank
                to appear as Anonymous.
              </p>
              <button type="submit" className="btn dark">
                Preview my story
                <ArrowRight size={16} />
              </button>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function About({
  close,
  share,
}: {
  close: () => void;
  share: () => void;
}) {
  return (
    <Dialog titleId="dialog-title" close={close}>
      <p className="eyebrow">
        <Globe2 size={14} />
        ABOUT RYE
      </p>
      <h2 id="dialog-title">
        Raise Your <em>Equality.</em>
      </h2>
      <p className="sheet-intro">
        An atlas of LGBTQ+ voices, told one story at a time.
      </p>
      <div className="prose">
        <p>
          Our name takes its cue from “raise your voice.” Here, raising your
          voice can mean describing a chair pulled up at a family table, a name
          finally spoken aloud, or the day you asked someone to change a rule.
        </p>
        <p>
          RYE brings those moments together so people can see what equality
          feels like in everyday life. You choose the words, the name, the
          place, and the colors that accompany your story.
        </p>
        <p>
          The opening collection uses clearly marked fictional stories and
          original illustrations. Stories added by contributors appear as
          community stories.
        </p>
      </div>
      <button type="button" className="btn dark" onClick={share}>
        Share your story
        <ArrowUpRight size={15} />
      </button>
    </Dialog>
  );
}
