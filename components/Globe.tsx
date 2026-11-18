"use client";

import { useEffect, useRef } from "react";
import { maskHex } from "../lib/atlas-mask";

const width = 720;
const height = 360;
const land = Uint8Array.from(maskHex.match(/../g)!, (pair) =>
  parseInt(pair, 16),
);
const tau = Math.PI * 2;
type Draw = (longitude: number) => void;

function isLand(x: number, y: number) {
  const index =
    Math.min(height - 1, Math.max(0, y)) * width + ((x + width) % width);
  return (land[index >> 3] >> (index & 7)) & 1;
}

// Precompute the projection for a fixed camera tilt. Turning the globe then
// requires only a longitude offset, so the land and grid stay together.
function makeProjection(canvas: HTMLCanvasElement): Draw {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const size = Math.min(
    800,
    Math.max(
      225,
      Math.round(
        canvas.clientWidth * Math.min(1.8, window.devicePixelRatio || 1),
      ),
    ),
  );
  canvas.width = size;
  canvas.height = size;
  const img = ctx.createImageData(size, size);
  const count = size * size;
  const lon = new Float32Array(count),
    lat = new Float32Array(count);
  const shade = new Float32Array(count),
    grain = new Float32Array(count);
  const radius = size / 2 - 1.7;
  const tilt = (22 * Math.PI) / 180;
  const sinTilt = Math.sin(tilt),
    cosTilt = Math.cos(tilt);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const nx = (x - size * 0.5) / radius,
        ny = (size * 0.5 - y) / radius;
      const d = nx * nx + ny * ny;
      if (d >= 1) {
        lat[i] = -1;
        continue;
      }
      const nz = Math.sqrt(1 - d);
      lat[i] =
        (0.5 - Math.asin(ny * cosTilt + nz * sinTilt) / Math.PI) * height;
      lon[i] =
        (0.5 + Math.atan2(nx, nz * cosTilt - ny * sinTilt) / tau) * width;
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
  return (longitude) => {
    const delta = (longitude * width) / 360;
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

export default function Globe({ longitude }: { longitude: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(longitude);
  const draw = useRef<Draw | null>(null);
  useEffect(() => {
    const el = canvas.current!;
    let frame = 0;
    function resize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        draw.current = makeProjection(el);
        draw.current(current.current);
      });
    }
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      draw.current = null;
    };
  }, []);
  useEffect(() => {
    const start = current.current;
    const arc = ((longitude - start + 540) % 360) - 180;
    if (
      Math.abs(arc) < 0.01 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      current.current = longitude;
      draw.current?.(longitude);
      return;
    }
    const began = performance.now();
    let frame = 0;
    function turn(now: number) {
      const phase = Math.min(1, (now - began) / 750);
      current.current = start + arc * (1 - Math.pow(1 - phase, 3));
      draw.current?.(current.current);
      if (phase < 1) frame = requestAnimationFrame(turn);
    }
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [longitude]);
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
