"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Clock3, Globe2, MapPin, MessageCircle } from "lucide-react";
import { flagThemes, readTime, type Flag, type Voice } from "../lib/voices";
import { Dialog } from "./Dialog";
import { StoryGallery } from "./StoryPhotos";
import { Face } from "./VoiceArt";

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

export function StoryText({ story }: { story: Voice }) {
  const photos = story.photos?.length ? story.photos : story.portrait !== undefined
    ? [{ src: `/portraits/voice-${story.portrait}.jpg`, description: `Illustrated portrait of ${story.name}` }]
    : [];
  return (
    <article className={"story-spread" + (photos.length ? " with-art" : "")}>
      <header className="story-letterhead">
        <h2 id="dialog-title">{story.title}</h2>
        <p className="story-signature">
          {story.usePhotoAsPortrait && story.photos?.[0] && <span className="signature-portrait"><Face voice={story} /></span>}
          <span>By <strong>{story.name}</strong></span>
        </p>
        <div className="story-facts">
          {story.place && <span><MapPin size={14} aria-hidden="true" />{story.place}</span>}
          <span><Clock3 size={14} aria-hidden="true" />{readTime(story.body)} min read</span>
        </div>
        <div className="story-topics">
          <span className="topic-tag">{story.topic}</span><FlagChip flag={story.flag} />
        </div>
      </header>
      {photos.length > 0 && <StoryGallery photos={photos} flag={story.flag} illustrated={story.sample} />}
      <div className="prose story-prose">
        {story.body.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {story.sample && <p className="sample-note">This fictional story and illustrated portrait are part of RYE’s sample collection.</p>}
      </div>
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
    <Dialog titleId="dialog-title" close={close} variant="reader" label={story.sample ? "Illustrative story" : "Community story"}>
      <StoryText story={story} />
      <footer className="folio-end">
        <div className="dialog-actions">
          <button type="button" className="btn dark" onClick={close}>
            <ArrowLeft size={15} />
            Back to the atlas
          </button>
          {!story.sample && !story.mine && (
            <a className="btn outline" href={`/connections/?story=${encodeURIComponent(story.id)}`}>
              <MessageCircle size={16} aria-hidden="true" /> Request to connect
            </a>
          )}
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
      </footer>
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
