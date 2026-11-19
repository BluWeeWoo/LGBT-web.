import { jpegDataPrefix, maxPortraitBytes } from "./voices";

const printSize = 544;
const ink = [59, 34, 46];
const rose = [215, 177, 202];
const peach = [241, 203, 177];

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }

function smoothstep(from: number, to: number, value: number) {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function hatch(phase: number, width: number) {
  const distance = Math.abs(phase - Math.round(phase));
  return 1 - smoothstep(width - .09, width + .09, distance);
}

// Smooth camera noise without softening the boundaries of eyes, lips and hair.
function smoothLuminance(gray: Float32Array, width: number, height: number) {
  const weights = Float32Array.from({ length: 256 }, (_, delta) => Math.exp(-delta * delta / 450));
  const kernel = [1, 4, 6, 4, 1];
  let src = gray;
  for (const horizontal of [true, false]) {
    const out = new Float32Array(gray.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let sum = 0, total = 0;
        for (let k = -2; k <= 2; k++) {
          const j = horizontal
            ? y * width + Math.max(0, Math.min(width - 1, x + k))
            : Math.max(0, Math.min(height - 1, y + k)) * width + x;
          const amount = kernel[k + 2] * weights[Math.round(Math.abs(src[j] - src[i]))];
          sum += src[j] * amount;
          total += amount;
        }
        out[i] = sum / total;
      }
    }
    src = out;
  }
  return src;
}

/** Convert sRGB pixels to the atlas's ink-and-paper palette in place. */
export function printPortraitPixels(pixels: Uint8ClampedArray, width: number, height: number) {
  const gray = new Float32Array(width * height);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = .299 * pixels[p] + .587 * pixels[p + 1] + .114 * pixels[p + 2];
    histogram[Math.round(gray[i])]++;
  }
  function percentile(fraction: number) {
    let count = 0;
    for (let v = 0; v < 256; v++) {
      count += histogram[v];
      if (count >= gray.length * fraction) return v;
    }
    return 255;
  }
  const black = percentile(.025) * .88;
  const span = Math.max(45, percentile(.98) * .88 + 255 * .12 - black);
  const smoothed = smoothLuminance(gray, width, height);
  let grainSeed = 0x526965;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const above = Math.max(0, y - 3) * width, below = Math.min(height - 1, y + 3) * width;
    for (let x = 0; x < width; x++) {
      const i = row + x, p = i * 4;
      const value = smoothed[i];
      const neighborhood = (smoothed[row + Math.max(0, x - 3)] + smoothed[row + Math.min(width - 1, x + 3)]
        + smoothed[above + x] + smoothed[below + x]) * .25;
      const tone = clamp((value - black) / span);
      const shade = 1 - tone;
      const contour = smoothstep(.008, .13, (neighborhood - value) / span);
      const warmth = clamp(.13 + (pixels[p] - pixels[p + 2]) / 88 + .18 * tone);

      // Bend the engraved strokes with the broad tones; crosshatch only the shadows.
      grainSeed = (Math.imul(1664525, grainSeed) + 1013904223) >>> 0;
      const grain = (grainSeed >>> 16) / 65535 - .5;
      const bend = neighborhood / span + .34 * Math.sin(y / 31) + .23 * Math.sin((x + y) / 71);
      const primary = hatch((.78 * x + .62 * y) / 4.3 + 1.7 * bend + grain * .05, .035 + .17 * shade);
      const cross = hatch((.43 * x - .90 * y) / 5.3 + .85 * bend, .065 + .09 * shade);
      const wash = .46 * shade * shade + .52 * smoothstep(.66, .98, shade);
      let coverage = wash + (1 - wash) * .80 * contour;
      coverage += (1 - coverage) * primary * .83 * smoothstep(.14, .64, shade);
      coverage += (1 - coverage) * cross * .67 * smoothstep(.57, .88, shade);

      const fiber = grain * (10 + 9 * coverage) + (gray[i] - value) * .20;
      for (let c = 0; c < 3; c++) {
        const paper = rose[c] + (peach[c] - rose[c]) * warmth;
        pixels[p + c] = paper + (ink[c] - paper) * coverage + fiber;
      }
    }
  }
}

export async function makePortraitPrint(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = printSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw Error("The portrait preview is unavailable.");

  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const left = (image.naturalWidth - side) / 2;
  const top = (image.naturalHeight - side) * .4;
  context.fillStyle = "#d7b1ca";
  context.fillRect(0, 0, printSize, printSize);
  context.drawImage(image, left, top, side, side, 0, 0, printSize, printSize);
  const frame = context.getImageData(0, 0, printSize, printSize);
  printPortraitPixels(frame.data, printSize, printSize);
  context.putImageData(frame, 0, 0);
  for (const quality of [.9, .78, .62]) {
    const src = canvas.toDataURL("image/jpeg", quality);
    if (src.startsWith(jpegDataPrefix) && src.length <= jpegDataPrefix.length + 4 * Math.ceil(maxPortraitBytes / 3)) return src;
  }
  throw Error("The portrait preview could not be prepared.");
}
