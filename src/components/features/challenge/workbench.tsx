"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseJson,
  setPersistentValue,
  usePersistentValue,
} from "@/lib/hooks/use-persistent-state";
import { Btn } from "@/components/ui/btn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Snapshot = { at: string; size: number; hash: string };
type PasteEvent = { at: string; length: number };
type PromptEntry = { at: string; tool: string; purpose: string };
type Persisted = {
  code: string;
  snapshots: Snapshot[];
  pasteEvents: PasteEvent[];
  prompts: PromptEntry[];
};

const STARTER = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Rebuild Landing Page</title>
</head>
<body>
  <header>
    <h1>Belajar membangun, bukan menyalin</h1>
  </header>
  <main>
    <section aria-labelledby="fitur">
      <h2 id="fitur">Fitur utama</h2>
      <p>Tulis markup semantik dan layout responsif di sini.</p>
    </section>
  </main>
</body>
</html>`;

const TABS = ["Editor", "Preview", "Test", "Konsol"] as const;
type Tab = (typeof TABS)[number];

const TESTS = [
  { name: "Halaman memuat tanpa error", passed: true },
  { name: "Semantic HTML (header, nav, main, footer)", passed: true },
  { name: "Layout 375px tanpa scroll horizontal", passed: true },
  { name: "Semua gambar punya alt text", passed: false },
  { name: "Kontras teks memenuhi 4.5:1", passed: true },
  { name: "Navigasi keyboard mencapai semua kontrol", passed: true },
];

const EMPTY: Persisted = { code: STARTER, snapshots: [], pasteEvents: [], prompts: [] };

function stamp(): string {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

export function Workbench({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const storageKey = `ls_challenge_${taskId}`;
  const persisted = parseJson<Persisted>(usePersistentValue(storageKey), EMPTY);
  const { code, snapshots, pasteEvents, prompts } = persisted;

  const [tab, setTab] = useState<Tab>("Editor");
  const [seconds, setSeconds] = useState(0);
  const [promptOpen, setPromptOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const stateRef = useRef(persisted);

  useEffect(() => {
    stateRef.current = persisted;
  }, [persisted]);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = stateRef.current;
      const snap: Snapshot = {
        at: stamp(),
        size: current.code.length,
        hash: shortHash(current.code),
      };
      setPersistentValue(
        storageKey,
        JSON.stringify({ ...current, snapshots: [snap, ...current.snapshots].slice(0, 20) }),
      );
    }, 120000);
    return () => window.clearInterval(id);
  }, [storageKey]);

  function update(next: Persisted) {
    setPersistentValue(storageKey, JSON.stringify(next));
  }

  function recordSnapshot() {
    const current = stateRef.current;
    const snap: Snapshot = {
      at: stamp(),
      size: current.code.length,
      hash: shortHash(current.code),
    };
    update({ ...current, snapshots: [snap, ...current.snapshots].slice(0, 20) });
    setNotice(`Snapshot tersimpan: ${snap.hash}`);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text");
    if (text.length > 50) {
      const entry = { at: stamp(), length: text.length };
      update({ ...persisted, pasteEvents: [entry, ...persisted.pasteEvents].slice(0, 20) });
      setNotice(`Paste massal terdeteksi: ${text.length} karakter (hanya panjang, bukan isi).`);
    }
  }

  function addPrompt(tool: string, purpose: string) {
    update({ ...persisted, prompts: [{ at: stamp(), tool, purpose }, ...persisted.prompts].slice(0, 20) });
    setPromptOpen(false);
  }

  const timer = useMemo(() => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
  }, [seconds]);

  const passed = TESTS.filter((test) => test.passed).length;

  return (
    <div>
      <div className="card-head">
        <div>
          <p className="section-label">IDE-lite</p>
          <h1 className="card-title" style={{ fontSize: "1.4rem" }}>
            {taskTitle}
          </h1>
        </div>
        <div className="row-aside">
          <span className="status status-info mono">Timer {timer}</span>
          <Button
            type="button"
            variant="glass"
            size="pill-sm"
            onClick={recordSnapshot}
          >
            Simpan snapshot
          </Button>
        </div>
      </div>

      {notice ? (
        <p className="alert alert-ok" role="status" style={{ marginBottom: "0.75rem" }}>
          {notice}
        </p>
      ) : null}

      <div className="challenge-layout">
        <aside className="card">
          <h2 className="card-title" style={{ fontSize: "0.95rem" }}>
            Process Trail
          </h2>
          <p className="card-sub">Snapshot otomatis tiap 2 menit dan saat kamu simpan manual.</p>
          <ul className="log-list-app" style={{ listStyle: "none", padding: 0, marginTop: "0.75rem" }}>
            {snapshots.length === 0 ? <li className="muted">Belum ada snapshot.</li> : null}
            {snapshots.map((snap, index) => (
              <li className="log-line" key={index}>
                <span className="muted">{snap.at}</span>
                <span className="mono">{snap.hash}</span>
              </li>
            ))}
          </ul>

          <h2 className="card-title" style={{ fontSize: "0.95rem", marginTop: "1.25rem" }}>
            Paste Guard
          </h2>
          <ul className="log-list-app" style={{ listStyle: "none", padding: 0 }}>
            {pasteEvents.length === 0 ? <li className="muted">Tidak ada paste massal.</li> : null}
            {pasteEvents.map((event, index) => (
              <li className="log-line" key={index}>
                <span className="muted">{event.at}</span>
                <span className="mono">{event.length} karakter</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="editor-panel">
          <div className="editor-toolbar" role="tablist" aria-label="Panel kerja">
            {TABS.map((item) => (
              <Button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                variant="ghost"
                size="sm"
                className={cn("tab-btn", tab === item && "is-active")}
                onClick={() => setTab(item)}
              >
                {item}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="tab-btn"
              onClick={() => setPromptOpen((value) => !value)}
            >
              + Catat Prompt AI
            </Button>
          </div>

          {promptOpen ? (
            <form
              className="card"
              style={{ padding: "1rem" }}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                addPrompt(String(data.get("tool") ?? "AI"), String(data.get("purpose") ?? ""));
              }}
            >
              <div className="field">
                <label htmlFor="p-tool">Alat</label>
                <Input id="p-tool" name="tool" placeholder="ChatGPT / Copilot / Claude" required />
              </div>
              <div className="field">
                <label htmlFor="p-purpose">Untuk apa</label>
                <Input id="p-purpose" name="purpose" placeholder="Menjelaskan konsep async" required />
              </div>
              <Button className="btn-primary" variant="brand" size="pill" type="submit">
                Catat
              </Button>
            </form>
          ) : null}

          {tab === "Editor" ? (
            <textarea
              className="code-editor"
              value={code}
              onChange={(event) => update({ ...persisted, code: event.target.value })}
              onPaste={handlePaste}
              spellCheck={false}
              aria-label="Editor kode"
            />
          ) : null}

          {tab === "Preview" ? (
            <iframe
              title="Preview karya"
              className="code-editor"
              sandbox=""
              srcDoc={code}
              style={{ background: "#fff", color: "#0A2A3A" }}
            />
          ) : null}

          {tab === "Test" ? (
            <div className="card">
              <p className="caption muted">
                Auto-check: {passed}/{TESTS.length} lulus (Playwright + Lighthouse saat submit)
              </p>
              <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0, marginTop: "0.5rem" }}>
                {TESTS.map((test) => (
                  <li className="log-line" key={test.name}>
                    <span>{test.name}</span>
                    <span className={`status status-${test.passed ? "ok" : "danger"}`}>
                      {test.passed ? "lulus" : "gagal"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "Konsol" ? (
            <div className="card">
              <p className="mono" style={{ fontSize: "0.82rem" }}>
                {prompts.length} prompt AI tercatat · {snapshots.length} snapshot · {pasteEvents.length} paste massal
              </p>
              <ul className="log-list-app" style={{ listStyle: "none", padding: 0 }}>
                {prompts.map((prompt, index) => (
                  <li className="log-line" key={index}>
                    <span className="muted">
                      {prompt.at} · {prompt.tool}
                    </span>
                    <span>{prompt.purpose}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Btn href="/submission">Submit karya</Btn>
            <Btn variant="ghost" href="/belajar">
              Kembali ke belajar
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
