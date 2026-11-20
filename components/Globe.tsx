"use client";

import { useCallback, useEffect, useRef } from "react";
import { atlasTilt, isLand, maskWidth as width, maskHeight as height } from "../lib/atlas-land";
import { globeRadius, radians, shortestTurn, type GlobeView } from "../lib/globe-view";
const tau = Math.PI * 2;
type Draw = (view: GlobeView) => void;

function makeProjection(canvas: HTMLCanvasElement, size: number): Draw {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  canvas.width = size;
  canvas.height = size;
  const img = ctx.createImageData(size, size);
  const count = size * size;
  const lon = new Float32Array(count),
    lat = new Float32Array(count);
  const shade = new Float32Array(count),
    grain = new Float32Array(count);
  const radius = size * globeRadius;
  const axis = Float32Array.from({ length: size }, (_, i) => (i - size / 2) / radius);
  const depth = new Float32Array(count);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const nx = axis[x], ny = -axis[y];
      const d = nx * nx + ny * ny;
      if (d >= 1) {
        lat[i] = -1;
        continue;
      }
      const nz = Math.sqrt(1 - d);
      depth[i] = nz;
      const lighting = -nx * 0.43 + ny * 0.5 + nz * 0.72;
      shade[i] = lighting * 17 - Math.pow(d, 2.2) * 14;
      let hash = Math.imul(x + y * size + 7, 0x45d9f3b);
      hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
      grain[i] = (((hash >>> 14) & 255) / 255 - 0.5) * 8;
      img.data[i * 4 + 3] = Math.min(
        255,
        Math.round((1 - Math.sqrt(d)) * radius * 255),
      );
    }
  }

  let previousLatitude: number | undefined;
  return ({ longitude, latitude }) => {
    // Reuse the inverse projection when the view turns at the same latitude.
    if (previousLatitude !== latitude) {
      const sin = Math.sin(latitude * radians), cos = Math.cos(latitude * radians);
      for (let y = 0; y < size; y++) {
        const ny = -axis[y];
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const nz = depth[i];
          if (nz <= 0) continue;
          const north = Math.max(-1, Math.min(1, ny * cos + nz * sin));
          lat[i] = (0.5 - Math.asin(north) / Math.PI) * height;
          lon[i] = (0.5 + Math.atan2(axis[x], nz * cos - ny * sin) / tau) * width;
        }
      }
      previousLatitude = latitude;
    }
    const delta = ((longitude % 360) * width) / 360;
    for (let i = 0; i < count; i++) {
      const v = lat[i];
      if (v < 0) continue;
      const u = (lon[i] + delta + width * 2) % width;
      const ix = u | 0,
        iy = v | 0;
      const mass = isLand(ix, iy);
      const sx = u * 1.09,
        sy = v * 1.02;
      const dotX = ((sx + (Math.floor(sy) % 2) * 0.5) % 1) - 0.5;
      const dotY = (sy % 1) - 0.5;
      const ink = mass
        ? Math.max(0, 1 - (dotX * dotX + dotY * dotY) * 4.3) * 39
        : 0;
      const graticule = Math.min(u % 30, 30 - (u % 30), v % 30, 30 - (v % 30));
      const line = Math.max(0, 1 - graticule / 0.55) * (mass ? 12 : 27);
      const coast =
        mass &&
        (!isLand(ix - 1, iy) ||
          !isLand(ix + 1, iy) ||
          !isLand(ix, iy - 1) ||
          !isLand(ix, iy + 1))
          ? 10
          : 0;
      const change = shade[i] + grain[i] - ink - line - coast;
      img.data[i * 4] = (mass ? 159 : 218) + change;
      img.data[i * 4 + 1] = (mass ? 133 : 208) + change;
      img.data[i * 4 + 2] = (mass ? 185 : 229) + change;
    }
    ctx.putImageData(img, 0, 0);
  };
}

type Props = { longitude: number; latitude?: number; onView?: (view: GlobeView) => void };

export default function Globe({ longitude, latitude = atlasTilt / radians, onView }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef({ longitude, latitude });
  const moving = useRef(false);
  const draw = useRef<Draw | null>(null);
  const paint = useCallback((view: GlobeView) => {
    const el = canvas.current!;
    const pixels = Math.round(el.clientWidth * Math.min(1.8, window.devicePixelRatio || 1));
    // A smaller frame during motion keeps the changing two-axis projection responsive.
    const size = Math.min(moving.current ? 360 : 800, Math.max(225, pixels));
    if (!draw.current || el.width !== size) draw.current = makeProjection(el, size);
    draw.current(view);
    onView?.(view);
  }, [onView]);
  useEffect(() => {
    const el = canvas.current!;
    let frame = 0;
    function resize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => paint(current.current));
    }
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      draw.current = null;
    };
  }, [paint]);
  useEffect(() => {
    const start = current.current;
    const arc = shortestTurn(start.longitude, longitude);
    const tilt = latitude - start.latitude;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const target = { longitude, latitude };
    if (motion.matches || Math.max(Math.abs(arc), Math.abs(tilt)) < 0.01) {
      moving.current = false;
      current.current = target;
      paint(target);
      return;
    }
    const began = performance.now();
    let frame = 0;
    function turn(now: number) {
      const phase = motion.matches ? 1 : Math.min(1, (now - began) / 750);
      const progress = 1 - (1 - phase) ** 3;
      moving.current = phase < 1;
      current.current = moving.current
        ? { longitude: start.longitude + arc * progress, latitude: start.latitude + tilt * progress }
        : target;
      paint(current.current);
      if (moving.current) frame = requestAnimationFrame(turn);
    }
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [latitude, longitude, paint]);
  return (
    <canvas
      className="earth"
      ref={canvas}
      width="550"
      height="550"
      aria-hidden="true"
    />
  );
}
