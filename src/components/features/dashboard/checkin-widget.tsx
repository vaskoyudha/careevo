"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseJson,
  setPersistentValue,
  usePersistentValue,
} from "@/lib/hooks/use-persistent-state";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ls_checkin_start";
const LOG_KEY = "ls_checkin_log";

type LogItem = { start: string; end: string; minutes: number };

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatClock(value: number): string {
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function CheckinWidget() {
  const startedRaw = usePersistentValue(STORAGE_KEY);
  const startedAt = startedRaw ? Number(startedRaw) : null;
  const log = parseJson<LogItem[]>(usePersistentValue(LOG_KEY), []);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed = useMemo(
    () => (startedAt === null ? 0 : Math.max(0, now - startedAt)),
    [startedAt, now],
  );

  function start() {
    const value = Date.now();
    setPersistentValue(STORAGE_KEY, String(value));
    setNow(value);
  }

  function stop() {
    if (startedAt === null) return;
    const end = Date.now();
    const minutes = Math.max(1, Math.round((end - startedAt) / 60000));
    const next = [
      { start: formatClock(startedAt), end: formatClock(end), minutes },
      ...log,
    ].slice(0, 5);
    setPersistentValue(LOG_KEY, JSON.stringify(next));
    setPersistentValue(STORAGE_KEY, null);
  }

  const running = startedAt !== null;

  return (
    <div>
      <p className="caption muted">
        Timer sesi lokal. Durasi tercatat sebagai bukti proses, bukan rekam ketukan.
      </p>
      <div className="score-hero" style={{ margin: "0.75rem 0" }}>
        <b className="mono">{formatDuration(elapsed)}</b>
        <span>{running ? "sesi berjalan" : "belum check-in"}</span>
      </div>
      <div className="hero-actions" style={{ marginTop: 0 }}>
        {running ? (
          <Button type="button" variant="brand" size="pill" onClick={stop}>
            Check-out
          </Button>
        ) : (
          <Button type="button" variant="brand" size="pill" onClick={start}>
            Check-in sekarang
          </Button>
        )}
      </div>
      {log.length > 0 ? (
        <ul className="log-list-app" style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
          {log.map((item, index) => (
            <li className="log-line" key={`${item.start}-${index}`}>
              <span className="muted">
                {item.start} - {item.end}
              </span>
              <span className="mono">{item.minutes} menit</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
