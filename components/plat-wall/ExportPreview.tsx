"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { platQueryParams, type PlatQuery } from "@/src/plat-wall/query";

type Status = { state: "loading" } | { state: "error" } | { state: "ready"; dims: string };

const intl = new Intl.NumberFormat("en-US");

export function ExportPreview({
  query,
  fileName,
  onClose,
}: {
  query: PlatQuery;
  fileName: string;
  onClose: () => void;
}) {
  const [stamp, setStamp] = useState(() => Date.now());
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const params = platQueryParams(query);
  const downloadParams = new URLSearchParams(params);
  downloadParams.set("download", "1");
  params.set("t", String(stamp));
  const src = `/api/plat-wall/export?${params.toString()}`;
  const downloadHref = `/api/plat-wall/export?${downloadParams.toString()}`;
  const ready = status.state === "ready";

  return createPortal(
    <div className="ov" role="dialog" aria-modal="true" aria-label="PNG preview">
      <div className="ov-bar">
        <div>
          <h2>PNG preview</h2>
          <div className="dims">{ready ? status.dims : status.state === "error" ? "Failed" : "Generating…"}</div>
        </div>
        <div className="ov-actions">
          <a
            className="btn-export"
            {...(ready ? { href: downloadHref, download: fileName } : { "aria-disabled": "true" as const })}
          >
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
              </g>
            </svg>
            Download PNG
          </a>
          <button type="button" className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {status.state === "loading" && (
        <div className="ov-wait">
          <div className="spin" />
          Generating your image…
        </div>
      )}
      {status.state === "error" && (
        <div className="ov-wait">
          Couldn&apos;t generate the image.
          <button
            type="button"
            className="btn-close"
            onClick={() => {
              setStatus({ state: "loading" });
              setStamp(Date.now());
            }}
          >
            Retry
          </button>
        </div>
      )}
      <div className="ov-frame" hidden={!ready}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt="Plat Wall preview"
          style={{ display: "block", width: "100%", height: "auto" }}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            setStatus({ state: "ready", dims: `${intl.format(w)} × ${intl.format(h)} px` });
          }}
          onError={() => setStatus({ state: "error" })}
        />
      </div>
    </div>,
    document.body,
  );
}
