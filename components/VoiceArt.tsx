import { MapPin } from "lucide-react";
import { Bloom } from "./Brand";
import type { Voice } from "../lib/voices";

const colors = [
  "#d9c8e7",
  "#e4c1a8",
  "#bfd1ca",
  "#c8d5b8",
  "#c4cfe4",
  "#e6c5cc",
];
export function Face({ voice }: { voice: Voice }) {
  return voice.portrait !== undefined ? (
    <img
      src={`/portraits/voice-${voice.portrait}.jpg`}
      alt=""
      draggable={false}
    />
  ) : (
    <span className="initial-avatar" aria-hidden="true">
      {Array.from(voice.name.trim())[0]?.toLocaleUpperCase() || "✧"}
    </span>
  );
}

function Postmark() {
  return (
    <svg
      className="postmark"
      viewBox="0 0 140 65"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="29" cy="32" r="23" />
      <circle cx="29" cy="32" r="18.8" strokeDasharray="1.5 2.8" />
      <path d="M18 35l22-7-12 13-2-7-8-1 22-8" strokeLinejoin="round" />
      {[14, 21, 28, 35, 42].map((y) => (
        <path key={y} d={`M53 ${y}q10 -7 20 0t20 0t20 0t20 0`} />
      ))}
    </svg>
  );
}
export function Postcard({ voice }: { voice: Voice }) {
  return (
    <span
      className={`postcard card-tone-${(voice.portrait ?? 0) % 3}`}
      style={{ backgroundColor: colors[voice.portrait ?? 0] }}
    >
      <span className="post-latitudes" aria-hidden="true" />
      <span className="card-place">
        <MapPin size={13} />
        {voice.place || "Community voice"}
      </span>
      <span className="post-stamp">
        <span className="stamp-window">
          <Face voice={voice} />
        </span>
      </span>
      <Postmark />
      <Bloom className="post-bloom" />
    </span>
  );
}
