"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/contexts/ToastContext";
import { LoadingSpinner } from "@/components/Logo";

type ErrorLog = {
  id: string;
  endpoint: string;
  message: string;
  stack?: string;
  metadata?: string;
  created_at: number;
};

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: spinning ? "spin 1s linear infinite" : undefined }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function LogViewerPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs?limit=150");
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch {
      toast.show("Failed to load logs", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = async () => {
    if (
      !confirm(
        "Are you sure you want to clear all error logs from the database?"
      )
    )
      return;
    setClearing(true);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setLogs([]);
        toast.show(`Cleared ${data.cleared ?? 0} log entries`, "ok");
      }
    } catch {
      toast.show("Failed to clear logs", "error");
    } finally {
      setClearing(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.endpoint.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q) ||
        (l.metadata && l.metadata.toLowerCase().includes(q))
    );
  }, [logs, searchQuery]);

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div className="stack stack--24">
          {/* Navigation & Actions */}
          <div
            className="row row--8"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Link href="/" className="btn btn--ghost btn--sm">
              <BackIcon /> Return to Home
            </Link>
            <div className="row row--8">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setRefreshing(true);
                  fetchLogs();
                }}
                disabled={refreshing}
                type="button"
              >
                <RefreshIcon spinning={refreshing} />{" "}
                {refreshing ? "Refreshing…" : "Refresh Logs"}
              </button>
              {logs.length > 0 && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={handleClear}
                  disabled={clearing}
                  style={{ color: "var(--danger)" }}
                  type="button"
                >
                  <TrashIcon /> {clearing ? "Clearing…" : "Clear Logs"}
                </button>
              )}
            </div>
          </div>

          {/* Header */}
          <div>
            <div className="badge badge--live" style={{ marginBottom: 8 }}>
              <span className="badge-live-pulse" />
              System Diagnostics & Audit Log
            </div>
            <h1
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.3rem)",
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Database Error Logs
            </h1>
            <p
              className="text-muted"
              style={{
                maxWidth: 720,
                marginTop: 6,
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Centralized exception audit trail stored in the database. End
              users are shown clean generic notifications while full technical
              stack traces and metadata are securely retained here.
            </p>
          </div>

          {/* Metric Ribbon */}
          <div className="metric-ribbon" style={{ marginTop: 2 }}>
            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ color: logs.length > 0 ? "var(--warn)" : "var(--ok)" }}
              >
                {logs.length}
              </div>
              <div className="metric-card__label">Logged Exceptions</div>
              <div className="metric-card__sub">
                {logs.length === 0
                  ? "Zero errors recorded"
                  : "Active audit entries"}
              </div>
            </div>

            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ fontSize: "1.25rem" }}
              >
                {logs.length > 0
                  ? new Date(logs[0].created_at).toLocaleTimeString()
                  : "—"}
              </div>
              <div className="metric-card__label">Most Recent Event</div>
              <div className="metric-card__sub">
                {logs.length > 0
                  ? new Date(logs[0].created_at).toLocaleDateString()
                  : "No recent errors"}
              </div>
            </div>

            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ color: "var(--ok)" }}
              >
                Operational
              </div>
              <div className="metric-card__label">Error Interceptor</div>
              <div className="metric-card__sub">Auto sanitization enabled</div>
            </div>

            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ fontSize: "1.25rem", color: "var(--info)" }}
              >
                Convex / Memory
              </div>
              <div className="metric-card__label">Persistence Layer</div>
              <div className="metric-card__sub">Failover DB sync</div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row row--8" style={{ alignItems: "center" }}>
              <input
                className="input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by Error Ref (e.g. ERR-123), endpoint, or message…"
                style={{ width: "100%" }}
              />
              {searchQuery && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Log Entries Stream */}
          <section className="stack stack--12">
            <div
              className="row row--8"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                Audit Records ({filteredLogs.length})
              </h2>
            </div>

            {loading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 200,
                  gap: 12,
                }}
              >
                <LoadingSpinner size={36} label="Loading logs…" />
                <span className="text-muted text-sm">
                  Loading database logs…
                </span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div
                className="card"
                style={{ padding: "40px 24px", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--ok)",
                    marginBottom: 4,
                  }}
                >
                  ✓ No Error Records Found
                </div>
                <p className="text-sm text-muted">
                  {searchQuery
                    ? "No log entries matched your search query."
                    : "All systems are operating normally. Future errors will appear here automatically."}
                </p>
              </div>
            ) : (
              <div className="stack stack--8">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedIds.has(log.id);
                  let parsedMeta: any = null;
                  if (log.metadata) {
                    try {
                      parsedMeta = JSON.parse(log.metadata);
                    } catch {
                      parsedMeta = log.metadata;
                    }
                  }

                  return (
                    <article
                      className="card"
                      key={log.id}
                      style={{ padding: "16px 20px" }}
                    >
                      <div
                        className="row row--8"
                        style={{
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div
                          className="row row--8"
                          style={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <span
                            className="badge badge--danger"
                            style={{
                              fontFamily: "monospace",
                              fontSize: "12px",
                            }}
                          >
                            {log.id}
                          </span>
                          <span className="badge badge--neutral">
                            {log.endpoint}
                          </span>
                          <span className="text-xs text-muted">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => toggleExpand(log.id)}
                          type="button"
                          style={{ fontSize: "12px" }}
                        >
                          {isExpanded ? "Hide Details ▲" : "View Stack Trace ▼"}
                        </button>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--text)",
                        }}
                      >
                        {log.message}
                      </div>

                      {isExpanded && (
                        <div
                          className="stack stack--8"
                          style={{
                            marginTop: 14,
                            paddingTop: 12,
                            borderTop: "1px solid var(--border)",
                          }}
                        >
                          {log.stack && (
                            <div>
                              <div
                                className="text-xs text-muted"
                                style={{ fontWeight: 700, marginBottom: 4 }}
                              >
                                Stack Trace:
                              </div>
                              <pre
                                style={{
                                  background: "var(--surface2)",
                                  padding: "12px 14px",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "12px",
                                  lineHeight: 1.5,
                                  overflowX: "auto",
                                  color: "var(--text2)",
                                }}
                              >
                                {log.stack}
                              </pre>
                            </div>
                          )}

                          {parsedMeta && (
                            <div>
                              <div
                                className="text-xs text-muted"
                                style={{ fontWeight: 700, marginBottom: 4 }}
                              >
                                Request Metadata:
                              </div>
                              <pre
                                style={{
                                  background: "var(--surface2)",
                                  padding: "12px 14px",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "12px",
                                  lineHeight: 1.5,
                                  overflowX: "auto",
                                  color: "var(--text2)",
                                }}
                              >
                                {typeof parsedMeta === "object"
                                  ? JSON.stringify(parsedMeta, null, 2)
                                  : parsedMeta}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
