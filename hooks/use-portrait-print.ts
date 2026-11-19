"use client";

import { useEffect, useState } from "react";
import { makePortraitPrint } from "../lib/portrait-print";

const inFlight = new Map<string, Promise<string>>();
type Result = { source: string; print?: string; failed?: boolean };

export function usePortraitPrint(source: string | undefined) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!source) return;
    let active = true;
    // A globe pin and postcard can request the same older portrait together.
    let work = inFlight.get(source);
    if (!work) {
      work = makePortraitPrint(source).finally(() => inFlight.delete(source));
      inFlight.set(source, work);
    }
    work.then(
      print => { if (active) setResult({ source, print }); },
      () => { if (active) setResult({ source, failed: true }); },
    );
    return () => { active = false; };
  }, [source]);
  return result?.source === source ? result : null;
}
