"use client";

import { useRef } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Globe2, Hand, MapPin } from "lucide-react";
import type { Voice } from "../lib/voices";
import { regionCenter } from "../lib/regions";
import { atlasTilt } from "../lib/atlas-land";
import { FlagChip } from "./Dialogs";
import FlagBackdrop from "./FlagBackdrop";
import AtlasGlobe from "./AtlasGlobe";
import { Face } from "./VoiceArt";

const slots = [[73, 57], [17, 49], [68, 13], [35, 18], [88, 32], [42, 82]];
const serial = (n: number) => String(n).padStart(2, "0");

function frontPosition(center: [number, number] | undefined, longitude: number) {
  if (!center) return { left: "60%", top: "48%" };
  const rad = Math.PI / 180;
  const lat = center[1] * rad, angle = (center[0] - longitude) * rad;
  const x = Math.cos(lat) * Math.sin(angle);
  const y = Math.cos(lat) * Math.cos(angle) * Math.sin(atlasTilt) - Math.sin(lat) * Math.cos(atlasTilt);
  const roll = -9 * rad;
  const dx = x * Math.cos(roll) - y * Math.sin(roll);
  const dy = x * Math.sin(roll) + y * Math.cos(roll);
  return { left: `calc(50% + ${48 * dx}cqh)`, top: `${48 + 48 * dy}%` };
}

type Props = {
  voices: Voice[];
  selectedId: string;
  select: (id: string) => void;
  read: (id: string) => void;
  arriving: boolean;
  onArrived: () => void;
};

export default function FeaturedPeople({ voices, selectedId, select, read, arriving, onArrived }: Props) {
  const index = Math.max(0, voices.findIndex(v => v.id === selectedId));
  const active = voices[index];
  const center = active.center || regionCenter(active.place);
  const longitude = center ? center[0] - 15 : 58;
  const first = Math.floor(index / slots.length) * slots.length;
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(-Infinity);
  const paper = useRef<HTMLDivElement>(null);
  const step = (by: number) => select(voices[(index + by + voices.length) % voices.length].id);

  return (
    <section id="atlas" className="atlas-section" data-arriving={arriving || undefined} aria-labelledby="atlas-title" aria-roledescription="carousel"
      onKeyDown={e => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        step(e.key === "ArrowLeft" ? -1 : 1);
      }}>
      <FlagBackdrop flag={active.flag}/>
      {arriving && <div className="atlas-arrival-paper" ref={paper} aria-hidden="true"/>}
      <div className="wrap atlas-grid">
        <div className="atlas-intro">
          <p className="eyebrow"><Globe2 size={14} aria-hidden="true"/>The story atlas</p>
          <h1 id="atlas-title">A world of <em>stories.</em></h1>
        </div>
        <div className="atlas-visual">
          <div className="globe-stage" onTouchStart={e => {
            swipe.current = { x:e.touches[0].clientX, y:e.touches[0].clientY };
          }} onTouchCancel={() => { swipe.current = null; }}
            onTouchEnd={e => {
              if (!swipe.current) return;
              const dx = e.changedTouches[0].clientX - swipe.current.x;
              const dy = e.changedTouches[0].clientY - swipe.current.y;
              swipe.current = null;
              if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                lastSwipe.current = performance.now();
                step(dx < 0 ? 1 : -1);
              }
            }}>
            <span className="orbit orbit-back" aria-hidden="true"/>
            <span className="orbit orbit-side" aria-hidden="true"/>
            <span className="world-shadow" aria-hidden="true"/>
            <AtlasGlobe longitude={longitude} arriving={arriving} paper={paper} onArrived={onArrived}/>
            <span className="orbit-dot orbit-dot-a" aria-hidden="true"/>
            <span className="orbit-dot orbit-dot-b" aria-hidden="true"/>
            <span className="spark spark-a" aria-hidden="true">✦</span>
            <span className="spark spark-b" aria-hidden="true">✧</span>
            {voices.slice(first, first + slots.length).map((v, i) => (
              <button key={v.id} type="button" className={`voice-pin pin-${i}${v.id === active.id ? " active" : ""}`}
                style={v.id === active.id ? frontPosition(center, longitude) : {left:slots[i][0]+"%",top:slots[i][1]+"%"}}
                aria-label={`Select ${v.name}${v.place ? " from " + v.place : ""}`} aria-pressed={v.id === active.id}
                onClick={() => { if (performance.now() - lastSwipe.current > 300) select(v.id); }}>
                <span className="pin-photo"><Face voice={v}/></span>
                <span className="pin-tag"><span className="pin-tag-dot"/>{v.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="spotlight">
          <article className="voice-profile" aria-live="polite" aria-atomic="true">
            <div className="profile-identity">
              <span className="profile-portrait"><Face voice={active}/></span>
              <h2 className={active.name.length > 16 ? "profile-name long-name" : "profile-name"}><span>{active.name}</span></h2>
            </div>
            <div className="profile-panel">
              <blockquote>“{active.quote}”</blockquote>
              <div className="profile-byline">
                <span><MapPin size={14} aria-hidden="true"/>{active.place || "Community voice"}</span>
                <FlagChip flag={active.flag}/>
              </div>
            </div>
            <div className="profile-read">
              <button className="story-link" type="button" onClick={() => read(active.id)}>
                {active.name === "Anonymous" || active.name.length > 20 ? "Read the story" : `Read ${active.name}’s story`}<ArrowUpRight size={16}/>
              </button>
              {active.sample && <span className="sample-label">Sample story</span>}
            </div>
          </article>
          <div className="profile-controls" role="group" aria-label="Choose a storyteller">
            <button type="button" className="round" aria-label="Previous voice" onClick={() => step(-1)}><ArrowLeft size={16}/></button>
            <span className="slide-index" aria-label={`Voice ${index + 1} of ${voices.length}`}><strong>{serial(index + 1)}</strong><span>/</span>{serial(voices.length)}</span>
            <button type="button" className="round" aria-label="Next voice" onClick={() => step(1)}><ArrowRight size={16}/></button>
          </div>
        </div>
        <div className="atlas-foot">
          <span className="explore-hint"><Hand size={14} aria-hidden="true"/>Select a portrait to explore</span>
          <a className="scroll-stories" href="#stories">Scroll to stories<ArrowDown size={15}/></a>
        </div>
      </div>
    </section>
  );
}
