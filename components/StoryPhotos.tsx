"use client";

import { useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, ImagePlus, X } from "lucide-react";
import { flagThemes, jpegDataPrefix, maxPhotoBytes, maxPhotoDescription, maxStoryPhotos, type Flag, type StoryPhoto } from "../lib/voices";
import { Dialog } from "./Dialog";
import { Postmark } from "./VoiceArt";

export function paperColors(flag: Flag): CSSProperties {
  const { colors } = flagThemes[flag];
  return { "--paper-ink-a": colors[0], "--paper-ink-b": colors[colors.length - 1] } as CSSProperties;
}

export function StoryGallery({ photos, flag, illustrated }: { photos: StoryPhoto[]; flag: Flag; illustrated: boolean }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const photo = photos[index];
  const description = photo.description || `Story photo ${index + 1}`;
  const step = (direction: number) => setIndex(i => (i + direction + photos.length) % photos.length);
  const controls = photos.length > 1 && (
    <div className="album-controls" role="group" aria-label="Story photos">
      <button type="button" className="round" aria-label="Previous photo" onClick={() => step(-1)}><ChevronLeft size={17} /></button>
      <span aria-live="polite">{index + 1} <span>/</span> {photos.length}</span>
      <button type="button" className="round" aria-label="Next photo" onClick={() => step(1)}><ChevronRight size={17} /></button>
    </div>
  );
  return (
    <figure className={"story-album" + (illustrated ? " illustrated-album" : "")} style={paperColors(flag)}>
      <div className="album-mat">
        <span className="post-latitudes" aria-hidden="true" />
        <button className="album-print" type="button" aria-label={`Enlarge ${description}`} onClick={() => setExpanded(true)}>
          <img src={photo.src} alt={description} />
          <span className="enlarge-icon"><Expand size={16} aria-hidden="true" /></span>
        </button>
        <Postmark />
      </div>
      <figcaption>
        <span>{description}</span>
        {controls}
      </figcaption>
      {expanded && (
        <Dialog titleId="photo-viewer-title" variant="photo" label={illustrated ? "Illustrated portrait" : "Story photos"}
          close={() => setExpanded(false)} onKeyDown={event => {
            if (photos.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
            event.preventDefault();
            step(event.key === "ArrowLeft" ? -1 : 1);
          }}>
          <div className="photo-viewer">
            <img src={photo.src} alt={description} />
            <div className="viewer-caption">
              <h2 id="photo-viewer-title">{description}</h2>
              {controls}
            </div>
          </div>
        </Dialog>
      )}
    </figure>
  );
}

async function preparePhoto(file: File): Promise<StoryPhoto> {
  const supported = file.type ? ["image/jpeg", "image/png", "image/webp"].includes(file.type) : /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!supported)
    throw Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 10 * 1024 * 1024) throw Error("Choose a photo smaller than 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw Error("This photo could not be opened. Try another image."); });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("This browser could not prepare the photo.");
    ctx.fillStyle = "#faf6ef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.84, .68, .5, .35]) {
      const src = canvas.toDataURL("image/jpeg", quality);
      if (src.startsWith(jpegDataPrefix) && src.length <= jpegDataPrefix.length + 4 * Math.ceil(maxPhotoBytes / 3))
        return { src, description: "" };
    }
    throw Error("Choose a smaller photo or crop it before adding it.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

type PickerProps = {
  photos: StoryPhoto[];
  onChange: (photos: StoryPhoto[]) => void;
  usePhotoAsPortrait: boolean;
  portraitPrint?: string;
  portraitFailed?: boolean;
  onPortraitChange: (checked: boolean) => void;
  preparing: boolean;
  onPreparing: (busy: boolean) => void;
};

export function PhotoPicker({ photos, onChange, usePhotoAsPortrait, portraitPrint, portraitFailed, onPortraitChange, preparing, onPreparing }: PickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function add(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setError("");
    if (photos.length + files.length > maxStoryPhotos) {
      setError(`A story can include up to ${maxStoryPhotos} photos.`);
      return;
    }
    onPreparing(true);
    try {
      const additions: StoryPhoto[] = [];
      for (const file of files) additions.push(await preparePhoto(file));
      onChange([...photos, ...additions]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be added.");
    } finally {
      onPreparing(false);
    }
  }
  return (
    <fieldset className="photo-picker">
      <legend>Story photos <small>(optional)</small></legend>
      <p className="photo-hint">Add up to {maxStoryPhotos} photos to show inside your story.</p>
      {photos.length > 0 && <div className="draft-photos">
        {photos.map((photo, index) => (
          <div className="draft-photo" key={index}>
            <img src={photo.src} alt={`Attached photo ${index + 1}`} />
            <label>
              <span>Describe photo {index + 1} <small>(optional)</small></span>
              <input value={photo.description} maxLength={maxPhotoDescription} placeholder="What’s in the picture?"
                disabled={preparing}
                onChange={event => onChange(photos.map((p, i) => i === index ? { ...p, description: event.target.value } : p))} />
            </label>
            <button type="button" className="round" disabled={preparing} aria-label={`Remove photo ${index + 1}`}
              onClick={() => {
                if (index === 0) onPortraitChange(false);
                onChange(photos.filter((_, i) => i !== index));
                setError("");
              }}><X size={16} /></button>
          </div>
        ))}
      </div>}
      {photos.length < maxStoryPhotos && <div className="photo-add">
        <input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" ref={input} onChange={add} />
        <button type="button" className="btn outline" disabled={preparing} onClick={() => input.current?.click()}>
          <ImagePlus size={17} />{preparing ? "Preparing photos…" : "Add photos"}
        </button>
        <small>JPG, PNG or WebP · 10 MB per photo</small>
      </div>}
      {photos.length > 0 && <label className="portrait-check">
        <input type="checkbox" checked={usePhotoAsPortrait} onChange={event => onPortraitChange(event.target.checked)} />
        <span>Use my first photo as my atlas portrait</span>
      </label>}
      {usePhotoAsPortrait && <div className="portrait-proof" aria-live="polite">
        {portraitPrint && <img src={portraitPrint} alt="Preview of your atlas portrait in plum ink" />}
        <div><strong>Atlas portrait</strong>
          <p>{portraitFailed ? "This portrait could not be prepared. Choose another photo or clear the portrait option."
            : portraitPrint ? "Your portrait in plum ink on rose paper." : "Preparing your ink portrait…"}</p>
        </div>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
    </fieldset>
  );
}
