import { regionCenter } from "./regions";
import type { Voice } from "./voices";

export const radians = Math.PI / 180;
export const globeRadius = 0.497;
export type GlobeView = { longitude: number; latitude: number };

function hashId(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  // Mix the final bits so similar IDs do not cluster at the same point.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function portraitAnchor(voice: Voice): GlobeView {
  if (voice.center) {
    return { longitude: voice.center[0], latitude: voice.center[1] };
  }
  const center = regionCenter(voice.place);
  const hash = hashId(voice.id);
  const x = (hash & 65535) / 65535;
  const y = (hash >>> 16) / 65535;
  // Spread stories sharing a country center using their IDs so adding or
  // reordering stories never moves the portraits already on the globe.
  return center
    ? {
        longitude: center[0] + (x - 0.5) * 36,
        latitude: Math.max(-88, Math.min(88, center[1] + (y - 0.5) * 26)),
      }
    : { longitude: x * 360 - 180, latitude: Math.asin(y * 1.86 - 0.93) / radians };
}

export function shortestTurn(from: number, to: number) {
  return ((((to - from + 180) % 360) + 360) % 360) - 180;
}

export function globeProjection(view: GlobeView) {
  const sin = Math.sin(view.latitude * radians);
  const cos = Math.cos(view.latitude * radians);
  return (anchor: GlobeView) => {
    const yaw = (anchor.longitude - view.longitude) * radians;
    const latitude = anchor.latitude * radians;
    const ring = Math.cos(latitude);
    const north = Math.sin(latitude);
    const front = ring * Math.cos(yaw);
    return {
      x: ring * Math.sin(yaw),
      y: front * sin - north * cos,
      depth: north * sin + front * cos,
    };
  };
}
