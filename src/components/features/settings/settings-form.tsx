"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({ nama, email, username }: { nama: string; email: string; username: string }) {
  const [saved, setSaved] = useState(false);
  const [consent, setConsent] = useState(true);
  const [timelineCleared, setTimelineCleared] = useState(false);

  return (
    <div className="grid-app">
      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <div className="card-head">
          <h2 className="card-title">Profil</h2>
          {saved ? <span className="status status-ok">Tersimpan</span> : null}
        </div>
        <div className="field">
          <Label htmlFor="s-nama">Nama tampilan</Label>
          <Input id="s-nama" name="nama" defaultValue={nama} />
        </div>
        <div className="field">
          <Label htmlFor="s-username">Username publik</Label>
          <Input id="s-username" name="username" defaultValue={username} readOnly />
        </div>
        <div className="field">
          <Label htmlFor="s-email">Email</Label>
          <Input id="s-email" name="email" defaultValue={email} readOnly />
        </div>
        <p className="caption muted">Email tidak ditampilkan di profil publik (Zero-PII).</p>
        <Button
          className="btn-primary"
          variant="brand"
          size="pill"
          type="submit"
          style={{ marginTop: "0.75rem" }}
        >
          Simpan profil
        </Button>
      </form>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Consent dan privasi</h2>
        </div>
        <Label htmlFor="s-consent" className="auth-consent" style={{ marginBottom: "1rem" }}>
          <Checkbox
            id="s-consent"
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
          />
          <span>Izinkan perekaman artefak proses (snapshot, prompt log) untuk sesi ini</span>
        </Label>
        <p className="caption muted">
          Nir-biometrik: tanpa webcam, tanpa rekam ketukan. Hanya artefak dan persetujuan eksplisit.
        </p>
        <Button
          type="button"
          variant="glass"
          size="pill-sm"
          style={{ marginTop: "0.75rem" }}
          onClick={() => setTimelineCleared(true)}
        >
          Hapus timeline saya
        </Button>
        {timelineCleared ? (
          <p className="alert alert-warn" style={{ marginTop: "1rem" }}>
            Timeline ditandai untuk dihapus pada demo ini. Aksi tercatat di audit log.
          </p>
        ) : null}
      </div>
    </div>
  );
}
