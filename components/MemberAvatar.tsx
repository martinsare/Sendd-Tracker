"use client";
import { useEffect, useState } from "react";

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const out = `${first}${second}`.toUpperCase();
  return out || "MS";
}

export function MemberAvatar({ name, imageUrl, size = 44 }: { name: string; imageUrl?: string | null; size?: number }) {
  const initials = initialsForName(name);
  const style: React.CSSProperties = { width: size, height: size };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <div className="member-avatar" style={style} aria-label={name}>
      {imageUrl && !failed ? (
        <img
          className="member-avatar__img"
          src={imageUrl}
          alt={`${name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="member-avatar__fallback" aria-hidden="true">
          {initials}
        </div>
      )}
    </div>
  );
}

export default MemberAvatar;
