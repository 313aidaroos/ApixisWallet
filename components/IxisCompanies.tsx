"use client";
import { useEffect, useRef, useState } from "react";
import { IXIS_COMPANIES } from "@/lib/ixis-companies";

/** Footer "Ixis companies" trigger. Opens on hover or focus (desktop) and on tap (mobile). */
export function IxisCompanies() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className={`ixis-menu${open ? " is-open" : ""}`}>
      <button type="button" className="ixis-trigger" aria-expanded={open} aria-controls="ixis-panel" onClick={() => setOpen((v) => !v)}>
        Ixis companies <span aria-hidden="true">▴</span>
      </button>
      <div id="ixis-panel" className="ixis-panel" role="region" aria-label="Ixis companies">
        <p className="ixis-panel-title">The Ixis family</p>
        <ul>
          {IXIS_COMPANIES.map((c) => (
            <li key={c.name}>
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                <strong>{c.name}</strong>
                <span>{c.brief}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
