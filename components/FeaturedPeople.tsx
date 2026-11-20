"use client";

import { useMemo, useRef } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Globe2, Hand, MapPin } from "lucide-react";
import type { Voice } from "../lib/voices";
import { portraitAnchor } from "../lib/globe-view";
import { FlagChip } from "./Dialogs";
import FlagBackdrop from "./FlagBackdrop";
import AtlasGlobe from "./AtlasGlobe";
import { Face } from "./VoiceArt";

const serial = (n: number) => String(n).padStart(2, "0");

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
  const pins = useMemo(() => voices.map(voice => ({ voice, anchor: portraitAnchor(voice) })), [voices]);
  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(-Infinity);
  const paper = useRef<HTMLDivElement>(null);
  const step = (by: number) => select(voices[(index + by + voices.length) % voices.length].id);

  return (
    <section id="atlas" className="atlas-section" data-arriving={arriving || undefined} aria-labelledby="atlas-title" aria-roledescription="carousel"
      onKeyDown={e => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        if ((e.target as HTMLElement).closest(".voice-pin")) stage.current?.focus({ preventScroll: true });
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
          <div className="globe-stage" ref={stage} tabIndex={-1} onTouchStart={e => {
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
            <AtlasGlobe view={pins[index].anchor} pins={pins} selectedId={active.id}
              select={id => { if (performance.now() - lastSwipe.current > 300) select(id); }}
              arriving={arriving} paper={paper} onArrived={onArrived}/>
            <span className="orbit-dot orbit-dot-a" aria-hidden="true"/>
            <span className="orbit-dot orbit-dot-b" aria-hidden="true"/>
            <span className="spark spark-a" aria-hidden="true">✦</span>
            <span className="spark spark-b" aria-hidden="true">✧</span>
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
