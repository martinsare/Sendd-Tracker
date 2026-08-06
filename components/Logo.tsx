"use client";

export function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/icon.png"
      alt="Senedd Tracker"
      width={size}
      height={size}
      style={{ borderRadius: Math.round(size * 0.22), display: "block", objectFit: "cover" }}
      onError={(e) => {
        // Fallback: hide broken image
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export function LoadingSpinner({ size = 56, label = "Loading…" }: { size?: number; label?: string }) {
  const imgSize = Math.round(size * 0.6);
  const imgOffset = Math.round((size - imgSize) / 2);
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const dashArray = `${Math.round(circumference * 0.28)} ${Math.round(circumference * 0.72)}`;

  return (
    <div
      className="loading-spinner-wrap"
      role="status"
      aria-label={label}
      style={{ width: size, height: size, position: "relative" }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0 }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#c41230"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={dashArray}
          className="loading-spinner-arc"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: imgOffset,
          left: imgOffset,
          width: imgSize,
          height: imgSize,
          borderRadius: Math.round(imgSize * 0.22),
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 900,
          fontSize: Math.round(imgSize * 0.45),
        }}
      >
        S
      </div>
    </div>
  );
}
