import Link from "next/link";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="logo-link" aria-label="Senedd Tracker — home">
      <span className="logo-dragon" aria-hidden="true">🐉</span>
      {!compact && <span className="logo-text">Senedd Tracker</span>}
    </Link>
  );
}
