import { env } from "cloudflare:workers";
import type { StoryMedia } from "../db/schema";
import { jpegDataPrefix, maxPhotoBytes, maxPhotoDescription, maxPortraitBytes, maxStoryPhotos } from "./voices";

const encodedLength = (bytes: number) => Math.ceil(bytes / 3) * 4;
export const maxStoryRequestBytes = 36000 + maxStoryPhotos * (encodedLength(maxPhotoBytes) + 2048) + encodedLength(maxPortraitBytes) + 128;

type PhotoUpload = { bytes: Uint8Array<ArrayBuffer>; description: string; portraitBytes?: Uint8Array<ArrayBuffer> };

function decodeJpeg(src: unknown, limit: number) {
  if (typeof src !== "string" || !src.startsWith(jpegDataPrefix) ||
      src.length > jpegDataPrefix.length + encodedLength(limit))
    throw Error("Choose the photo again so it can be prepared for the atlas.");
  let raw: string;
  try { raw = atob(src.slice(jpegDataPrefix.length)); }
  catch { throw Error("One of the photos could not be read."); }
  if (raw.length < 12 || raw.length > limit || !raw.startsWith("\xff\xd8\xff") || !raw.endsWith("\xff\xd9"))
    throw Error("One of the photos could not be read as a JPEG.");
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export function decodeStoryPhotos(input: unknown, usePhotoAsPortrait = false): PhotoUpload[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > maxStoryPhotos)
    throw Error(`Choose up to ${maxStoryPhotos} story photos.`);

  return input.map((photo, index) => {
    if (!photo || typeof photo.description !== "string" || photo.description.length > maxPhotoDescription)
      throw Error("Shorten the photo description and try again.");
    if (photo.portraitSrc !== undefined && (!usePhotoAsPortrait || index !== 0))
      throw Error("Select the first photo as your atlas portrait to include its print.");
    return {
      bytes: decodeJpeg(photo.src, maxPhotoBytes),
      description: photo.description.trim(),
      portraitBytes: photo.portraitSrc === undefined ? undefined : decodeJpeg(photo.portraitSrc, maxPortraitBytes),
    };
  });
}

export function photoKey(id: string, media: StoryMedia, index: number | "portrait") {
  return `stories/${id}/${media.album}/${index}.jpg`;
}

export async function removeStoryPhotos(id: string, media: StoryMedia | null) {
  if (!media) return;
  if (!env.BUCKET) throw Error("Photo storage is unavailable.");
  const keys = media.descriptions.map((_, index) => photoKey(id, media, index));
  if (media.hasPortraitPrint) keys.push(photoKey(id, media, "portrait"));
  await env.BUCKET.delete(keys);
}

export async function storeStoryPhotos(id: string, photos: PhotoUpload[], usePhotoAsPortrait: boolean) {
  if (!photos.length) return null;
  if (!env.BUCKET) throw Error("Photo storage is unavailable.");
  const portrait = usePhotoAsPortrait ? photos[0].portraitBytes : undefined;
  // Separate concurrent attempts so a losing insert can safely discard its own files.
  const media: StoryMedia = {
    album: crypto.randomUUID(),
    descriptions: photos.map(photo => photo.description),
    usePhotoAsPortrait,
    hasPortraitPrint: Boolean(portrait),
  };
  try {
    for (const [index, photo] of photos.entries()) {
      await env.BUCKET.put(photoKey(id, media, index), photo.bytes, { httpMetadata: { contentType: "image/jpeg" } });
    }
    if (portrait) {
      await env.BUCKET.put(photoKey(id, media, "portrait"), portrait, { httpMetadata: { contentType: "image/jpeg" } });
    }
  } catch (error) {
    await removeStoryPhotos(id, media);
    throw error;
  }
  return media;
}
