import { maskHex } from "./atlas-mask";

export const maskWidth = 720;
export const maskHeight = 360;
export const atlasTilt = 22 * Math.PI / 180;
const land = Uint8Array.from(maskHex.match(/../g)!, pair => parseInt(pair, 16));

export function isLand(x: number, y: number) {
  const row = Math.min(maskHeight - 1, Math.max(0, y));
  const index = row * maskWidth + ((x + maskWidth) % maskWidth);
  return (land[index >> 3] >> (index & 7)) & 1;
}
