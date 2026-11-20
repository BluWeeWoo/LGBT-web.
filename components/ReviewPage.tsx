"use client";

import { useEffect, useState } from "react";
import { reviewStates, type ReviewPage as Queue, type ReviewStatus } from "../lib/review-types";
import ReviewDesk from "./ReviewDesk";

type View = { page: Queue; status: ReviewStatus; query: string; paged: boolean };

export default function ReviewPage() {
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    const search = new URLSearchParams(window.location.search);
    const status = reviewStates.find(value => value === search.get("status")) ?? "pending";
    const query = (search.get("q") ?? "").trim().slice(0, 100);
    const cursor = search.get("cursor");
    const params = new URLSearchParams({ status, q: query });
    if (cursor) params.set("cursor", cursor);
    async function load() {
      try {
        const response = await fetch("/api/admin/stories?" + params, { cache: "no-store", signal: request.signal });
        if (request.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          window.location.replace(response.status === 401 ? "/login/" : "/");
          return;
        }
        if (!response.ok) throw new Error("Could not load the review desk.");
        const page: Queue = await response.json();
        if (!request.signal.aborted) setView({ page, status, query, paged: Boolean(cursor) });
      } catch {
        if (!request.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => request.abort();
  }, []);

  return view ? <ReviewDesk {...view} /> : (
    <main className="review-main">
      <p role="status">{failed ? "The review queue couldn’t load." : "Loading submissions…"}</p>
      {failed && <a className="text-link" href="/admin/">Try again</a>}
    </main>
  );
}
