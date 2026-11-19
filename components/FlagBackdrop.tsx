import { useId } from "react";
import { flagThemes, type Flag } from "../lib/voices";

// Keep every flag's original stop positions on the same, permanent gradient.
// CSS can then retarget each stop from its current displayed color mid-fade.
const offsets = [...new Set(Object.values(flagThemes).flatMap(({ colors }) =>
  colors.map((_, i) => i / (colors.length - 1))
))].sort((a, b) => a - b);

const paper = [246, 236, 223];

function sampleStop(colors: readonly string[], offset: number) {
  const position = offset * (colors.length - 1);
  const left = colors[Math.floor(position)];
  const right = colors[Math.ceil(position)];
  const fraction = position % 1;
  const rgb = paper.map((base, channel) => {
    const start = 1 + channel * 2;
    const a = parseInt(left.slice(start, start + 2), 16);
    const b = parseInt(right.slice(start, start + 2), 16);
    return Math.round(base * 0.67 + (a + (b - a) * fraction) * 0.33);
  });
  return `rgb(${rgb.join(",")})`;
}

export default function FlagBackdrop({ flag }: { flag: Flag }) {
  const id = useId();
  const { colors } = flagThemes[flag];
  return (
    <svg className="flag-wash" aria-hidden="true" focusable="false" preserveAspectRatio="none" viewBox="0 0 100 100">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="82%" colorInterpolation="sRGB">
          {offsets.map((offset) => (
            <stop key={offset} offset={offset} style={{ stopColor: sampleStop(colors, offset) }}/>
          ))}
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`}/>
    </svg>
  );
}
