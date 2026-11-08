"use client";

import { useActionState, useState, useTransition } from "react";
import { resetBanner, saveBannerPosition, saveNpsso, uploadBanner } from "@/app/(site)/settings/actions";
import type { FormResult } from "@/src/settings/npsso";

function Message({ result }: { result: FormResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? "set-msg ok" : "set-msg err"} role={result.ok ? "status" : "alert"}>
      {result.message}
    </p>
  );
}

export function BannerForm({ bannerUrl, posY }: { bannerUrl: string | null; posY: number }) {
  const [pos, setPos] = useState(posY);
  const [local, setLocal] = useState<string | null>(null);
  const [result, setResult] = useState<FormResult | null>(null);
  const [pending, start] = useTransition();
  const preview = local ?? bannerUrl;

  function run(fn: () => Promise<FormResult>) {
    start(async () => setResult(await fn()));
  }

  return (
    <div className="set-body">
      <div
        className="set-preview"
        role="img"
        aria-label="Banner preview"
        style={preview ? { backgroundImage: `url("${preview}")`, backgroundPositionY: `${pos}%` } : undefined}
      >
        {!preview && <span>Default banner</span>}
      </div>
      <form
        className="set-row"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          run(() => uploadBanner(null, data));
        }}
      >
        <label className="set-label" htmlFor="banner-file">
          Image (JPEG, PNG or WebP, 10 MB max)
        </label>
        <input
          id="banner-file"
          name="banner"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setLocal((old) => {
              if (old) URL.revokeObjectURL(old);
              return f ? URL.createObjectURL(f) : null;
            });
          }}
        />
        <button type="submit" className="set-btn" disabled={pending}>
          {pending ? "Working…" : "Upload banner"}
        </button>
      </form>
      <div className="set-row">
        <label className="set-label" htmlFor="banner-pos">
          Visible part
        </label>
        <input
          id="banner-pos"
          type="range"
          min={0}
          max={100}
          step={1}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
        />
        <div className="set-actions">
          <button
            type="button"
            className="set-btn"
            disabled={pending || !bannerUrl}
            onClick={() => run(() => saveBannerPosition(pos))}
          >
            Save position
          </button>
          <button
            type="button"
            className="set-btn ghost"
            disabled={pending || !bannerUrl}
            onClick={() => {
              setLocal(null);
              setPos(50);
              run(resetBanner);
            }}
          >
            Use default banner
          </button>
        </div>
        <Message result={result} />
      </div>
    </div>
  );
}

export function NpssoForm() {
  const [result, save, pending] = useActionState(saveNpsso, null);
  return (
    <form action={save} className="set-row">
      <label className="set-label" htmlFor="npsso">
        npsso
      </label>
      <input
        id="npsso"
        name="npsso"
        type="password"
        autoComplete="off"
        spellCheck={false}
        maxLength={256}
        className="set-input"
        required
      />
      <button type="submit" className="set-btn" disabled={pending}>
        {pending ? "Saving…" : "Save token"}
      </button>
      <Message result={result} />
    </form>
  );
}
