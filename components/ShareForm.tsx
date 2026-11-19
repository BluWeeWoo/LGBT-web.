"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Eye, Feather } from "lucide-react";
import { excerpt, flagThemes, topics, type Flag, type StoryPhoto, type Topic, type Voice } from "../lib/voices";
import { regionNames } from "../lib/regions";
import { Dialog } from "./Dialog";
import { StoryText } from "./Dialogs";
import { PhotoPicker, paperColors } from "./StoryPhotos";
import { Postcard } from "./VoiceArt";
import { usePortraitPrint } from "../hooks/use-portrait-print";

import type { ReviewStatus } from "../lib/review-types";

export function ShareForm({ close, submitted }: { close: () => void; submitted: (status: ReviewStatus) => void }) {
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [flag, setFlag] = useState<Flag>("rye");
  const [topic, setTopic] = useState<Topic>("Belonging");
  const [photos, setPhotos] = useState<StoryPhoto[]>([]);
  const [usePhotoAsPortrait, setPortrait] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submissionId = useRef("");
  const content = useRef<HTMLDivElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const wasPreview = useRef(false);
  const portrait = usePortraitPrint(usePhotoAsPortrait ? photos[0]?.src : undefined);
  const canPreview = !preparing && (!usePhotoAsPortrait || Boolean(portrait?.print));
  const data: Voice = {
    id: "preview", name: name.trim() || "Anonymous", place: place.trim(),
    title: title.trim(), body: body.trim(), quote: excerpt(body),
    flag, topic, sample: false, usePhotoAsPortrait: Boolean(portrait?.print),
    photos: portrait?.print ? photos.map((photo, i) => i === 0 ? { ...photo, portraitSrc: portrait.print } : photo) : photos,
  };
  useEffect(() => {
    const dialog = content.current?.closest("dialog");
    if (dialog) dialog.scrollTop = 0;
    if (preview) content.current?.focus({ preventScroll: true });
    else if (wasPreview.current) titleField.current?.focus({ preventScroll: true });
    wasPreview.current = preview;
  }, [preview]);

  function showPreview(event: FormEvent) {
    event.preventDefault();
    if (!canPreview) return;
    if (!data.title || data.body.length < 20) {
      setError("Add a title and at least 20 characters of story text.");
      return;
    }
    setError("");
    setPreview(true);
  }
  async function submitForReview(event: FormEvent) {
    event.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!submissionId.current) submissionId.current = crypto.randomUUID();
      const response = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, id: submissionId.current, consent }),
      });
      const result = await response.json() as { status: ReviewStatus; error?: string };
      if (!response.ok) throw Error(result.error || "Your story could not be submitted.");
      submitted(result.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again. Your draft is still here.");
      setBusy(false);
    }
  }
  return (
    <Dialog titleId="dialog-title" variant={preview ? "reader" : "compose"} label={preview ? "Story preview" : "Share a voice"}
      close={() => { if (!busy) close(); }}>
      <div ref={content} tabIndex={-1} className="draft-content">
        {preview ? <>
          <StoryText story={data} />
          <form onSubmit={submitForReview} className="folio-end">
            <label className="consent">
              <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>I agree to share this story{photos.length ? ", my selected photos," : ""} and these details on RYE if a reviewer approves it.</span>
            </label>
            <div className="dialog-actions">
              <button type="button" className="text-link" disabled={busy}
                onClick={() => { setPreview(false); setConsent(false); setError(""); }}>Back to editing</button>
              <button type="submit" className="btn dark" disabled={busy || !consent}>
                {busy ? "Submitting…" : "Submit for review"}<Check size={16} />
              </button>
            </div>
            {error && <p role="alert" className="error">{error}</p>}
          </form>
        </> : (
          <div className="writing-desk">
            <aside className="writing-cover" style={paperColors(flag)}>
              <div className="cover-copy">
                <h2 id="dialog-title">Share your <em>story.</em></h2>
                <p>Write it in your own words. Preview your story, then send it to RYE for review.</p>
              </div>
              <figure className="cover-postcard">
                <Postcard voice={data} />
                <figcaption><Feather size={15} aria-hidden="true" />{data.name}</figcaption>
              </figure>
            </aside>
            <form className="story-form writing-form" onSubmit={showPreview}>
              <label>Story title
                <input ref={titleField} required value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your story a title" maxLength={100} />
              </label>
              <div className="writing-body">
                <label>Your story
                  <textarea required value={body} onChange={e => setBody(e.target.value)} placeholder="Start with a moment you remember…"
                    minLength={20} maxLength={6000} rows={6} aria-describedby="story-count" />
                </label>
                <small className="char-count" id="story-count">{body.length.toLocaleString()} / 6,000</small>
              </div>
              <PhotoPicker photos={photos} onChange={setPhotos} usePhotoAsPortrait={usePhotoAsPortrait}
                portraitPrint={portrait?.print} portraitFailed={portrait?.failed}
                onPortraitChange={setPortrait} preparing={preparing} onPreparing={setPreparing} />
              <div className="form-row">
                <label><span>Display name <small>(optional)</small></span>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Anonymous" maxLength={55} autoComplete="off" />
                </label>
                <label><span>Country or region <small>(optional)</small></span>
                  <input value={place} onChange={e => setPlace(e.target.value)} placeholder="Where you’re writing from"
                    maxLength={65} autoComplete="off" list="region-names" />
                  <datalist id="region-names">{regionNames.map(region => <option key={region} value={region} />)}</datalist>
                </label>
              </div>
              <div className="form-row">
                <label>Story theme
                  <select value={topic} onChange={e => setTopic(e.target.value as Topic)}>
                    {topics.map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>Atlas colors
                  <select value={flag} onChange={e => setFlag(e.target.value as Flag)}>
                    {Object.entries(flagThemes).map(([key, theme]) => <option value={key} key={key}>{theme.name}</option>)}
                  </select>
                </label>
              </div>
              {error && <p role="alert" className="error">{error}</p>}
              <div className="writing-submit">
                <button type="submit" className="btn dark" disabled={!canPreview}><Eye size={16} />Preview my story</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Dialog>
  );
}
