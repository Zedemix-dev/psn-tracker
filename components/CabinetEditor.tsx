"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveCabinetAction } from "@/app/(site)/actions";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { TrophyItem } from "@/src/cabinet/item";

const MAX = 10;
const DEBOUNCE = 300;

function Row({ t, children }: { t: TrophyItem; children: React.ReactNode }) {
  return (
    <li>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.iconSrc} alt="" />
      <div className="ce-text">
        <div className="n">{t.name}</div>
        <div className="g">
          {t.game}
          {t.ratePct !== null && ` · ${t.ratePct} ${t.tier}`}
        </div>
      </div>
      <TrophyTypeIcon type={t.type} size={22} />
      <div className="ce-actions">{children}</div>
    </li>
  );
}

export function CabinetEditor({ initial }: { initial: TrophyItem[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<TrophyItem[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrophyItem[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEditor() {
    setChosen(initial);
    setQuery("");
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      searchRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      // After close(): while the modal is open the page behind it is inert and cannot take focus.
      openerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/trophies/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()) as TrophyItem[]);
        setSearchError(false);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      }
    }, DEBOUNCE);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const move = (from: number, to: number) =>
    setChosen((list) => {
      const next = [...list];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await saveCabinetAction(chosen.map((t) => ({ titleId: t.titleId, trophyId: t.trophyId })));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    } catch {
      setError("Could not save the cabinet");
    } finally {
      setSaving(false);
    }
  }

  const full = chosen.length >= MAX;
  const has = (t: TrophyItem) => chosen.some((c) => c.key === t.key);

  return (
    <>
      <button ref={openerRef} type="button" className="aside edit-btn" onClick={openEditor}>
        Edit
      </button>
      <dialog
        ref={dialogRef}
        className="ce glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ce-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {open && (
          <div className="ce-body">
            <h2 id="ce-title">Edit trophy cabinet</h2>
            <div className="ce-cols">
              <section aria-label="Search">
                <input
                  ref={searchRef}
                  type="search"
                  className="ce-search"
                  placeholder="Search earned trophies"
                  aria-label="Search earned trophies"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {searchError && <p className="ce-note">Search failed. Try again.</p>}
                <ul className="ce-list" aria-label="Search results">
                  {results.map((t) => (
                    <Row key={t.key} t={t}>
                      <button
                        type="button"
                        disabled={full || has(t)}
                        aria-label={`Add ${t.name}`}
                        onClick={() => setChosen((list) => [...list, t])}
                      >
                        Add
                      </button>
                    </Row>
                  ))}
                </ul>
              </section>
              <section aria-label="Chosen trophies">
                <p className="ce-count">
                  {chosen.length} / {MAX}
                </p>
                <ul className="ce-list" aria-label="Chosen trophies">
                  {chosen.map((t, i) => (
                    <Row key={t.key} t={t}>
                      <button
                        type="button"
                        disabled={i === 0}
                        aria-label={`Move up ${t.name}`}
                        onClick={() => move(i, i - 1)}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        disabled={i === chosen.length - 1}
                        aria-label={`Move down ${t.name}`}
                        onClick={() => move(i, i + 1)}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${t.name}`}
                        onClick={() => setChosen((list) => list.filter((c) => c.key !== t.key))}
                      >
                        Remove
                      </button>
                    </Row>
                  ))}
                </ul>
              </section>
            </div>
            {error && (
              <p className="ce-error" role="alert">
                {error}
              </p>
            )}
            <div className="ce-foot">
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={saving} onClick={save}>
                Save
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
