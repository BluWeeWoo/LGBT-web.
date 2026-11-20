"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { isLand, maskHeight, maskWidth } from "../lib/atlas-land";
import { globeProjection, globeRadius, radians, type GlobeView } from "../lib/globe-view";
import type { Voice } from "../lib/voices";
import Globe from "./Globe";
import { Face } from "./VoiceArt";

const viewSize = 480;
const radius = viewSize * globeRadius;
const letters = ["+", "#", "=", "*", "o"];

// Space marks evenly along each parallel and attach them to the rotating Earth.
function sampleGlobe(rows: number) {
  const marks = [];
  for (let row = 0; row < rows; row++) {
    const v = (row + .5) / rows;
    const latitude = (.5 - v) * Math.PI;
    const ring = Math.cos(latitude);
    const columns = Math.max(1, Math.round(2 * rows * ring));
    for (let column = 0; column < columns; column++) {
      const u = (column + (row % 2) * .5) / columns;
      const longitude = (u - .5) * Math.PI * 2;
      const land = Boolean(isLand(Math.floor(u * maskWidth), Math.floor(v * maskHeight)));
      marks.push({
        east: ring * Math.sin(longitude), north: Math.sin(latitude), front: ring * Math.cos(longitude),
        land, glyph: land ? letters[(row + column * 3) % letters.length] : ".",
      });
    }
  }
  return { marks, spacing: radius * Math.PI / rows };
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: ReturnType<typeof sampleGlobe>,
  angle: number, tilt: number, opacity: number, dots: boolean) {
  if (opacity <= 0) return;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const sinTilt = Math.sin(tilt), cosTilt = Math.cos(tilt);
  ctx.font = `600 ${layer.spacing * .92}px monospace`;
  for (const point of layer.marks) {
    const front = point.front * cos + point.east * sin;
    const depth = point.north * sinTilt + front * cosTilt;
    if (depth <= 0) continue;
    const x = (point.east * cos - point.front * sin) * radius;
    const y = (front * sinTilt - point.north * cosTilt) * radius;
    // Fade the grazing edge so the rows wrap around a sphere without a hard outline.
    ctx.globalAlpha = opacity * Math.min(1, depth * 6) * (point.land ? .70 + .30 * depth : .23 + .16 * depth);
    ctx.fillStyle = point.land ? "#50364f" : "#886478";
    if (dots) {
      const size = layer.spacing * (point.land ? .48 : .23);
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillText(point.glyph, x, y);
    }
  }
}

function blend(elapsed: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (elapsed - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function createPrintPainter(canvas: HTMLCanvasElement, view: GlobeView) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const coarse = sampleGlobe(19), medium = sampleGlobe(40), fine = sampleGlobe(96);
  let lastDraw = -Infinity;
  return (elapsed: number, diameter: number) => {
    const side = Math.max(1, Math.round(diameter * Math.min(window.devicePixelRatio || 1, 2)));
    const turn = Math.min(1, elapsed / 2100);
    if (canvas.width === side && (elapsed - lastDraw < 1000 / 30 || lastDraw >= 2100)) return;
    if (canvas.width !== side) canvas.width = canvas.height = side;
    ctx.setTransform(side / viewSize, 0, 0, side / viewSize, side / 2, side / 2);
    ctx.clearRect(-viewSize / 2, -viewSize / 2, viewSize, viewSize);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const angle = (view.longitude - 38 * (1 - turn) ** 2) * radians;
    const tilt = view.latitude * radians;
    const toMedium = blend(elapsed, 260, 920);
    const toFine = blend(elapsed, 930, 1650);
    drawLayer(ctx, coarse, angle, tilt, 1 - toMedium, false);
    drawLayer(ctx, medium, angle, tilt, toMedium * (1 - toFine), false);
    drawLayer(ctx, fine, angle, tilt, toFine, true);
    lastDraw = elapsed;
  };
}

function placePin(button: HTMLButtonElement, { x, y, depth }: { x: number; y: number; depth: number }) {
  button.toggleAttribute("data-front", depth > 0);
  if (depth <= 0) return;
  button.style.left = `${50 + x * globeRadius * 100}%`;
  button.style.top = `${50 + y * globeRadius * 100}%`;
  button.style.setProperty("--pin-opacity", String(Math.min(1, depth * 6)));
  button.style.setProperty("--pin-scale", String(0.52 + depth * 0.48));
  button.style.setProperty("--pin-depth", String(Math.round(depth * 1000)));
}

type Props = {
  view: GlobeView;
  pins: { voice: Voice; anchor: GlobeView }[];
  selectedId: string;
  select: (id: string) => void;
  arriving: boolean;
  paper: RefObject<HTMLDivElement | null>;
  onArrived: () => void;
};

export default function AtlasGlobe({ view, pins, selectedId, select, arriving, paper, onArrived }: Props) {
  const { longitude, latitude } = view;
  const dock = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const print = useRef<HTMLCanvasElement>(null);
  const pinNodes = useRef(new Map<string, { button: HTMLButtonElement; anchor: GlobeView }>());
  const currentView = useRef(view);
  const updatePins = useCallback((frame: GlobeView) => {
    currentView.current = frame;
    const project = globeProjection(frame);
    for (const { button, anchor } of pinNodes.current.values()) placePin(button, project(anchor));
  }, []);

  useLayoutEffect(() => {
    if (!arriving) return;
    const anchor = dock.current!, globe = surface.current!, sheet = paper.current!;
    const stage = anchor.parentElement!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paint = motion.matches ? null : createPrintPainter(print.current!, { longitude, latitude });
    const began = performance.now();
    let frame = 0;

    function animate(now: number) {
      const elapsed = now - began;
      let map, reveal, pins, duration;
      if (paint && !motion.matches) {
        // Measure the stationary carousel slot. Both globe surfaces travel together.
        const end = anchor.getBoundingClientRect();
        const screen = sheet.getBoundingClientRect();
        const diameter = Math.min(screen.width * .79, screen.height * .66, 608);
        const remaining = 1 - blend(elapsed, 1680, 2780);
        const x = (screen.left + screen.width / 2 - end.left - end.width / 2) * remaining;
        const y = (screen.top + screen.height / 2 - end.top - end.height / 2) * remaining;
        const scale = 1 + (diameter / Math.max(1, end.width) - 1) * remaining;
        globe.style.transform = remaining ? `translate3d(${x}px, ${y}px, 0) scale(${scale})` : "none";
        paint(elapsed, Math.max(diameter, end.width));
        map = blend(elapsed, 2110, 2780);
        reveal = blend(elapsed, 1810, 2840);
        pins = blend(elapsed, 2610, 3020);
        duration = 3120;
      } else {
        // A single short dissolve also works when the glyph canvas is unavailable.
        duration = 180;
        map = reveal = pins = blend(elapsed, 0, duration);
        globe.style.transform = "none";
      }
      globe.style.setProperty("--arrival-map", String(map));
      stage.style.setProperty("--arrival-pins", String(pins));
      sheet.style.opacity = String(1 - reveal);
      if (elapsed < duration) frame = requestAnimationFrame(animate);
      else onArrived();
    }
    animate(began);
    return () => {
      cancelAnimationFrame(frame);
      globe.style.removeProperty("transform");
      globe.style.removeProperty("--arrival-map");
      stage.style.removeProperty("--arrival-pins");
      sheet.style.removeProperty("opacity");
    };
  }, [arriving, latitude, longitude, onArrived, paper]);

  return (
    <div className="atlas-globe-dock" ref={dock}>
      <div className="atlas-globe-surface" ref={surface}>
        <Globe longitude={longitude} latitude={latitude} onView={updatePins}/>
        {arriving && <canvas className="welcome-print-globe" ref={print} width={viewSize} height={viewSize} aria-hidden="true"/>}
        <div className="atlas-globe-pins">
          {pins.map(({ voice, anchor }) => (
            <button key={voice.id} type="button" className={`voice-pin${voice.id === selectedId ? " active" : ""}`}
              ref={button => {
                if (button) {
                  pinNodes.current.set(voice.id, { button, anchor });
                  placePin(button, globeProjection(currentView.current)(anchor));
                } else {
                  pinNodes.current.delete(voice.id);
                }
              }}
              aria-label={`Select ${voice.name}${voice.place ? " from " + voice.place : ""}`}
              aria-pressed={voice.id === selectedId} onClick={() => select(voice.id)}>
              <span className="pin-photo"><Face voice={voice}/></span>
              <span className="pin-tag"><span className="pin-tag-dot"/>{voice.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
