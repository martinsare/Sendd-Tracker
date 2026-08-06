"use client";
import { useState } from "react";

type Props = {
  memberId: string;
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

export default function MemberAvatar({ name, imageUrl, size = "md" }: Props) {
  const [imgError, setImgError] = useState(false);

  const useInitials = !imageUrl || imgError;

  return (
    <span className={`member-avatar member-avatar--${size}`} aria-label={name}>
      {useInitials ? (
        <span className="member-avatar__initials" aria-hidden="true">
          {initials(name)}
        </span>
      ) : (
        <img
          src={imageUrl!}
          alt={name}
          className="member-avatar__img"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}
    </span>
  );
}
