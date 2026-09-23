export default function AppLoading() {
  return (
    <div className="app-main" aria-busy="true" aria-label="Memuat">
      <div className="skeleton" style={{ height: 32, width: "40%", marginBottom: "1.5rem" }} />
      <div className="grid-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="skeleton" key={item} style={{ height: 96 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 220, marginTop: "1.5rem" }} />
    </div>
  );
}
