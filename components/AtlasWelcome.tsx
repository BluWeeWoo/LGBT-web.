"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Bloom } from "./Brand";

export type IntroPhase = "idle" | "welcome" | "guide";

const steps = [
  { target: ".globe-stage", focus: ".voice-pin.active", title: "Explore the carousel.", text: "Select a person to see their story preview and watch the background blend into their Pride flag colors." },
  { target: "#stories .story-card", focus: "#stories .story-card", title: "Read more stories.", text: "Scroll down to Stories and choose a story to read." },
  { target: ".header-share", focus: ".header-share", title: "Share your story.", text: "Select Share your story when you’re ready to contribute." },
];

export default function AtlasWelcome({ phase, setPhase }: { phase: IntroPhase; setPhase: (next: IntroPhase) => void }) {
  const [step, setStep] = useState(0);
  const panel = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (phase !== "guide") return;
    const target = document.querySelector<HTMLElement>(steps[step].target);
    if (!target) return;
    target.classList.add("guide-highlight");
    const rect = target.getBoundingClientRect();
    if (step === 1 || rect.top < 0 || rect.bottom > window.innerHeight) {
      window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 32), behavior: "instant" });
    }
    panel.current?.focus({ preventScroll: true });
    return () => target.classList.remove("guide-highlight");
  }, [phase, step]);

  function dismiss() {
    setPhase("idle");
    document.querySelector<HTMLElement>(steps[step].focus)?.focus({ preventScroll: true });
  }
  if (phase === "welcome") return <p className="sr-only" role="status">Welcome to the story atlas.</p>;
  if (phase !== "guide") return null;
  return (
    <aside className="atlas-guide" aria-labelledby="guide-title" aria-describedby="guide-instruction"
      ref={panel} tabIndex={-1} onKeyDown={e => { if (e.key === "Escape") dismiss(); }}>
      <div className="guide-progress"><Bloom /><span>Atlas guide · {step + 1} of {steps.length}</span></div>
      <h2 id="guide-title">{steps[step].title}</h2>
      <p id="guide-instruction">{steps[step].text}</p>
      <div className="guide-actions">
        <button className="text-link" type="button" onClick={dismiss}>Skip</button>
        {step < steps.length - 1
          ? <button className="btn dark" type="button" onClick={() => setStep(step + 1)}>Next</button>
          : <button className="btn dark" type="button" onClick={dismiss}>Got it</button>}
      </div>
    </aside>
  );
}
