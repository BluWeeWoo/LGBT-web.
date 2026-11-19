"use client";

import { useEffect, useRef, type ReactNode, type KeyboardEventHandler } from "react";
import { X } from "lucide-react";
import { Bloom } from "./Brand";

let modalCount = 0;
let bodyOverflow = "";

export function Dialog({ titleId, children, close, variant, label, onKeyDown }: {
  titleId: string;
  children: ReactNode;
  close: () => void;
  variant?: "reader" | "compose" | "photo";
  label?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    if (modalCount++ === 0) bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      el.close();
      if (--modalCount === 0) document.body.style.overflow = bodyOverflow;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, []);
  const dismiss = (
    <button ref={closeButton} type="button" className="round sheet-close" onClick={close}
      aria-label={variant === "photo" ? "Close photo" : "Close dialog"}>
      <X size={19} aria-hidden="true" />
    </button>
  );
  return (
    <dialog ref={ref} className={variant ? `sheet folio folio-${variant}` : "sheet"} aria-labelledby={titleId} onKeyDown={onKeyDown}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
      }}>
      {variant ? (
        <div className="folio-bar">
          <span className="folio-context"><Bloom />{label}</span>
          {dismiss}
        </div>
      ) : dismiss}
      {children}
    </dialog>
  );
}
