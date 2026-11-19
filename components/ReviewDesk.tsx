"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, Feather, Globe2,
  Inbox, LogOut, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { ReviewPage, ReviewStatus, ReviewStory } from "../lib/review-types";
import { reviewStates } from "../lib/review-types";
import { flagThemes } from "../lib/voices";
import { followSession, leaveDemo } from "../lib/demo-session";
import { Brand } from "./Brand";
import Globe from "./Globe";
import { Dialog } from "./Dialog";
import { StoryText } from "./Dialogs";

const labels = { pending: "Pending", approved: "Approved", declined: "Declined" };
const icons = { pending: Inbox, approved: BookOpen, declined: X };
const dateLabel = (date: string) => new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
}).format(new Date(date));

function queueLink(status: ReviewStatus, query = "", cursor?: string) {
  const params = new URLSearchParams({ status });
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  return "/admin?" + params;
}

type Props = { page: ReviewPage | null; status: ReviewStatus; query: string; paged: boolean };
export default function ReviewDesk({ page, status, query, paged }: Props) {
  const [selected, setSelected] = useState<ReviewStory | null>(null);
  const [confirm, setConfirm] = useState<"approved" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState("");
  const [decided, setDecided] = useState<Record<string, "approved" | "declined">>({});
  const queue = useRef<HTMLHeadingElement>(null);
  const counts = page ? { ...page.counts } : null;
  if (counts) for (const result of Object.values(decided)) { counts.pending--; counts[result]++; }
  const rows = page?.stories.filter(row => !decided[row.id]) ?? [];

  function inspect(story: ReviewStory) {
    setSelected(story); setConfirm(null); setIssue(""); setStale(false); setNotice("");
  }
  async function decide() {
    if (!selected || !confirm || busy) return;
    setBusy(true); setIssue("");
    try {
      const response = await fetch("/api/admin/stories", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status: confirm }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setStale([403, 404, 409].includes(response.status));
        throw Error(result.error || "Could not save the decision.");
      }
      setDecided(old => ({ ...old, [selected.id]: confirm }));
      setNotice(confirm === "approved" ? `“${selected.title}” is now in the atlas.` : `“${selected.title}” was declined.`);
      setSelected(null);
      requestAnimationFrame(() => queue.current?.focus({ preventScroll: true }));
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "Could not reach the review desk. Try again.");
    } finally { setBusy(false); }
  }
  async function logOut() {
    try { followSession(await leaveDemo()); }
    catch { setNotice("Could not log out. Please try again."); }
  }
  return (
    <div className="review-layout">
      <aside className="review-rail">
        <a className="skip" href="#queue-heading">Skip to submissions</a>
        <Link className="review-brand" href="/" prefetch={false} aria-label="RYE home"><Brand/></Link>
        <nav aria-label="Review queues">
          <p>Submissions</p>
          {reviewStates.map(key => {
            const Icon = icons[key];
            return <a key={key} href={queueLink(key)} aria-current={key === status ? "page" : undefined}>
              <Icon size={19}/><span>{labels[key]}</span>{key === "pending" && counts && <b>{counts.pending}</b>}
            </a>;
          })}
        </nav>
        <div className="review-rail-foot">
          <Link href="/" prefetch={false}><Globe2 size={18}/>View atlas<ArrowUpRight size={14}/></Link>
          <button onClick={logOut}><LogOut size={17}/>Log out</button>
        </div>
      </aside>
      <main className="review-main">
        <header className="review-heading">
          <div><p className="review-kicker"><Feather size={15}/>Editorial desk</p><h1>Story <em>review.</em></h1></div>
          <span className="review-role"><ShieldCheck size={16}/>Administrator</span>
        </header>
        <section className="review-overview" aria-label="Submission counts">
          <a href={queueLink("pending")} className="review-feature">
            <div><span className="review-stat-label"><Clock3 size={16}/>Awaiting review</span>
              <strong>{counts?.pending ?? "—"}</strong>
              <span className="review-feature-link">Open the queue <ArrowRight size={15}/></span></div>
            <div className="review-world" aria-hidden="true"><Globe longitude={106}/>
              <i className="review-face first"/><i className="review-face second"/></div>
          </a>
          {(["approved", "declined"] as const).map(key => {
            const Icon = icons[key];
            return <a className={"review-stat " + key} key={key} href={queueLink(key)}>
              <span className="review-stat-label"><Icon size={17}/>{labels[key]}</span>
              <strong>{counts?.[key] ?? "—"}</strong><span>{key === "approved" ? "Published in the atlas" : "Kept off the atlas"}</span>
            </a>;
          })}
        </section>
        <section className="review-queue" aria-labelledby="queue-heading">
          <div className="review-tools">
            <h2 ref={queue} id="queue-heading" tabIndex={-1}>{status === "pending" ? "Review queue" : labels[status] + " stories"}</h2>
            <form action="/admin" role="search"><input type="hidden" name="status" value={status}/>
              <input type="search" aria-label="Search by title or author" name="q" defaultValue={query} maxLength={100} placeholder="Search title or author"/>
              <button aria-label="Search submissions"><Search size={17}/></button>
            </form>
            <a className="review-refresh" href={queueLink(status, query)} aria-label="Refresh queue" title="Refresh queue"><RefreshCw size={17}/></a>
          </div>
          <p role="status" className="review-notice">{notice}</p>
          {!page ? <div className="review-empty"><Inbox/><h3>The queue couldn’t load.</h3><a className="text-link" href={queueLink(status, query)}>Try again</a></div>
            : rows.length ? <ul className="review-list">
              {rows.map(story => <li key={story.id}>
                <button className="review-row" onClick={() => inspect(story)}>
                  <span className="review-seal" style={{ "--stamp": flagThemes[story.flag].colors[0] } as CSSProperties} aria-hidden="true"><Feather size={19}/></span>
                  <span className="review-row-name"><strong>{story.title}</strong><small>By {story.name}{story.place && " · " + story.place}</small></span>
                  <span className="review-date">{dateLabel(story.createdAt)}</span>
                  <span className={"review-pill " + status}>{labels[status]}</span><ChevronRight size={17}/>
                </button>
              </li>)}
            </ul> : <div className="review-empty"><Inbox size={28}/>
              <h3>{query ? "No matching submissions." : status === "pending" ? "You’re all caught up." : "No " + status + " stories yet."}</h3>
              {query ? <a className="text-link" href={queueLink(status)}>Clear search</a> :
                status === "pending" && !page.cursor && <p>New stories will appear here when contributors send them for review.</p>}
            </div>}
          {(paged || page?.cursor) && <nav className="review-paging" aria-label="Queue pages">
            {paged && <a href={queueLink(status, query)}><ArrowLeft size={15}/>First page</a>}
            {page?.cursor && <a href={queueLink(status, query, page.cursor)}>More submissions<ArrowRight size={15}/></a>}
          </nav>}
        </section>
      </main>
      {selected && <Dialog variant="reader" label="Submission details" titleId="dialog-title" close={() => { if (!busy) setSelected(null); }}>
        <StoryText story={selected}/>
        <div className="folio-end review-decision">
          <p className="review-detail-status"><span className={"review-pill " + status}>{labels[status]}</span>
            Submitted {dateLabel(selected.createdAt)}{selected.reviewedAt && " · Reviewed " + dateLabel(selected.reviewedAt)}</p>
          {issue && <p className="error" role="alert">{issue}</p>}
          {stale ? <a href={queueLink(status, query)} className="btn outline">Refresh queue</a> :
            status === "pending" && (confirm ? <>
              <p role="status">{confirm === "approved" ? "Publish this story and its selected photos to the atlas?" : "Decline this submission and keep it off the atlas?"}</p>
              <div className="dialog-actions"><button disabled={busy} className="btn outline" onClick={() => setConfirm(null)}>Cancel</button>
                <button disabled={busy} className="btn dark" onClick={decide}>{busy ? "Saving…" : confirm === "approved" ? "Confirm approval" : "Confirm decline"}</button></div>
            </> : <div className="dialog-actions">
              <button onClick={() => setConfirm("declined")} className="btn outline"><X size={16}/>Decline</button>
              <button onClick={() => setConfirm("approved")} className="btn dark"><Check size={16}/>Approve and publish</button></div>)}
        </div>
      </Dialog>}
    </div>
  );
}
