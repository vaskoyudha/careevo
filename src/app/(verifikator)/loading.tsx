export default function VerifikatorLoading() {
  return (
    <div className="app-main" aria-busy="true" aria-label="Memuat area verifikator">
      <div className="skeleton" style={{ height: 32, width: "35%", marginBottom: "1.5rem" }} />
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}
