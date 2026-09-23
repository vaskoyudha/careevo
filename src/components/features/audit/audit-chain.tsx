"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface ChainRow {
  id: string;
  at: string;
  actor_type: string;
  actor_id: string;
  action: string;
  summary: string;
  prev_hash: string | null;
  entry_hash: string;
}

export function AuditChain({ rows }: { rows: ChainRow[] }) {
  const [tamperId, setTamperId] = useState<string | null>(null);

  const brokenFrom = tamperId ? rows.findIndex((row) => row.id === tamperId) : -1;
  const intact = brokenFrom === -1;

  return (
    <div className="grid-app">
      <div className={`alert ${intact ? "alert-ok" : "alert-danger"}`} role="status">
        {intact ? (
          <>Rantai utuh: {rows.length} entry, semua hash tertaut dan cocok.</>
        ) : (
          <>
            Simulasi tamper pada entry {tamperId}: hash entry berubah, sehingga semua entry setelahnya gagal
            verifikasi. Ini bukti tamper-evident.
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table-app">
            <thead>
              <tr>
                <th scope="col">Waktu</th>
                <th scope="col">Aktor</th>
                <th scope="col">Aksi</th>
                <th scope="col">Ringkasan</th>
                <th scope="col">Hash</th>
                <th scope="col">Aksi demo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const broken = brokenFrom !== -1 && index >= brokenFrom;
                return (
                  <tr key={row.id} style={broken ? { background: "rgba(228, 87, 46, 0.08)" } : undefined}>
                    <td className="muted">{row.at}</td>
                    <td>
                      {row.actor_type}
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {row.actor_id}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {row.action}
                    </td>
                    <td>{row.summary}</td>
                    <td className="mono" style={{ fontSize: "0.74rem" }}>
                      {broken ? <span className="status status-danger">FAIL</span> : row.entry_hash.slice(0, 10)}
                    </td>
                    <td>
                      {tamperId === row.id ? (
                        <Button type="button" variant="ghost" size="sm" className="tab-btn" onClick={() => setTamperId(null)}>
                          Pulihkan
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" className="tab-btn" onClick={() => setTamperId(row.id)}>
                          Ubah 1 byte
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
