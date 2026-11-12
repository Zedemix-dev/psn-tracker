"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { resetBanner, saveBannerPosition, saveNpsso, saveUnobtainableListUrl, uploadBanner } from "@/app/(site)/(banner)/settings/actions";
import type { FormResult } from "@/src/settings/npsso";

function Message({ result }: { result: FormResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? "set-msg ok" : "set-msg err"} role={result.ok ? "status" : "alert"}>
      {result.message}
    </p>
  );
}

export function BannerForm({
  bannerUrl,
  posY,
  auto,
}: {
  bannerUrl: string | null;
  posY: number;
  auto: { url: string; gameName: string } | null;
}) {
  const [pos, setPos] = useState(posY);
  const [local, setLocal] = useState<string | null>(null);
  const [result, setResult] = useState<FormResult | null>(null);
  const [pending, start] = useTransition();
  const custom = local ?? bannerUrl;
  const preview = custom ?? auto?.url ?? null;

  function run(fn: () => Promise<FormResult>) {
    start(async () => setResult(await fn()));
  }

  return (
    <div className="set-body">
      <div
        className="set-preview"
        role="img"
        aria-label="Banner preview"
        style={preview ? { backgroundImage: `url("${preview}")`, backgroundPositionY: `${custom ? pos : 25}%` } : undefined}
      >
        {!preview && <span>Default banner</span>}
        {!custom && auto && <span>Automatic — last played game ({auto.gameName})</span>}
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
          disabled={!custom}
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
            Use automatic banner
          </button>
        </div>
        <Message result={result} />
      </div>
    </div>
  );
}

export function NpssoForm() {
  // Submitted by hand: React 19 resets the fields of a form whose action ran, and a failed attempt must keep what was pasted.
  const [value, setValue] = useState("");
  const [result, save, pending] = useActionState(async (prev: FormResult | null, form: FormData) => {
    const res = await saveNpsso(prev, form);
    if (res.ok) setValue("");
    return res;
  }, null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(() => save(form));
      }}
      className="set-row"
    >
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
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

export function UnobtainableForm({ url }: { url: string }) {
  const [result, save, pending] = useActionState(saveUnobtainableListUrl, null);
  return (
    <form action={save} className="set-row">
      <label className="set-label" htmlFor="list-url">
        List address
      </label>
      <input
        id="list-url"
        name="url"
        type="text"
        spellCheck={false}
        defaultValue={url}
        className="set-input"
        required
      />
      <button type="submit" className="set-btn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <Message result={result} />
    </form>
  );
}
