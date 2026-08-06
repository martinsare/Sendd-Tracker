"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import MemberAvatar from "@/components/MemberAvatar";
import {
  getMember,
  getMemberParticipation,
  triggerRefresh,
  type MemberDetail,
  type ParticipationResult,
  type ContributionItem,
  type VoteItem,
} from "@/lib/api";

type Tab = "overview" | "contributions" | "votes" | "sources";

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") return null;
  return <span className={`confidence-badge confidence-badge--${confidence}`}>{confidence}</span>;
}

function VoteResultChip({ result }: { result: string }) {
  const r = result.toLowerCase();
  const cls =
    r === "for" || r === "dros" ? "for" :
    r === "against" || r === "yn erbyn" ? "against" :
    r === "abstain" || r === "ymatal" ? "abstain" : "unknown";
  return <span className={`vote-chip vote-chip--${cls}`}>{result}</span>;
}

function SpeechCard({ item, locale }: { item: ContributionItem; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const snippet = locale === "cy" ? (item.snippetCy ?? item.snippetEn) : item.snippetEn;
  const context = locale === "cy" ? (item.contextCy ?? item.contextEn) : (item.contextEn ?? item.contextCy);

  return (
    <li className="speech-card">
      {context && <p className="speech-card__context">{context}</p>}
      <p className="speech-card__date">
        {new Date(item.occurredAt).toLocaleDateString(locale === "cy" ? "cy-GB" : "en-GB", {
          day: "numeric", month: "long", year: "numeric",
        })}
        {" "}<ConfidenceBadge confidence={item.confidence} />
      </p>
      <p className="speech-card__snippet">{snippet}</p>
      {!expanded && item.snippetEn && item.snippetEn.endsWith("…") && (
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setExpanded(true)}
        >
          Read more
        </button>
      )}
      <a
        href={`${item.sourceUrl}#contribution-${item.contributionId}`}
        target="_blank" rel="noreferrer noopener"
        className="source-link"
      >
        View in Record ↗
      </a>
    </li>
  );
}

function VoteCard({ item, locale }: { item: VoteItem; locale: string }) {
  const name = locale === "cy" ? (item.voteNameCy ?? item.voteNameEn) : (item.voteNameEn ?? item.voteNameCy);
  const resultText = locale === "cy" ? (item.voteResultCy ?? item.voteResultEn) : (item.voteResultEn ?? item.voteResultCy);

  return (
    <li className="vote-card">
      <div className="vote-card__header">
        <VoteResultChip result={item.memberResult} />
        <ConfidenceBadge confidence={item.confidence} />
        <span className="vote-card__date">
          {new Date(item.occurredAt).toLocaleDateString(locale === "cy" ? "cy-GB" : "en-GB", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </span>
      </div>
      {name && <p className="vote-card__name">{name}</p>}
      {resultText && (
        <p className="vote-card__result">
          Result: {resultText}
          {item.totalsFor != null && (
            <span className="vote-card__totals">
              {" "}({item.totalsFor} for / {item.totalsAgainst} against / {item.totalsAbstain} abstain)
            </span>
          )}
        </p>
      )}
      <a
        href={item.sourceUrl}
        target="_blank" rel="noreferrer noopener"
        className="source-link"
      >
        View in Record ↗
      </a>
    </li>
  );
}

export default function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);
  const { t, locale } = useI18n();
  const { addToast } = useToast();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [participation, setParticipation] = useState<ParticipationResult | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loadingMember, setLoadingMember] = useState(true);
  const [loadingParticipation, setLoadingParticipation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingMember(true);
    setMemberError(null);
    getMember(decodedId)
      .then((m) => { setMember(m); })
      .catch((e: unknown) => setMemberError(String((e as Error)?.message ?? e)))
      .finally(() => setLoadingMember(false));
  }, [decodedId]);

  useEffect(() => {
    setLoadingParticipation(true);
    getMemberParticipation(decodedId, { page })
      .then((r) => {
        setParticipation((prev) => {
          if (!prev || page === 0) return r;
          return {
            ...r,
            contributions: [...prev.contributions, ...r.contributions],
            votes: [...prev.votes, ...r.votes],
          };
        });
      })
      .catch((e: unknown) => console.error(e))
      .finally(() => setLoadingParticipation(false));
  }, [decodedId, page]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerRefresh({ maxMeetings: 6, force: false });
      addToast(t("refreshSuccess"), "success");
      // Reload participation data
      const fresh = await getMemberParticipation(decodedId, { page: 0 });
      setParticipation(fresh);
      setPage(0);
    } catch {
      addToast(t("refreshFailed"), "error");
    } finally {
      setRefreshing(false);
    }
  };

  if (loadingMember)
    return <div className="loading-text">{t("loading")}</div>;

  if (memberError || !member)
    return (
      <div className="member-not-found">
        <h1>{t("memberNotFound")}</h1>
        <p>{t("memberNotFoundDetail")}</p>
        <Link href="/" className="btn btn--primary">{t("back")}</Link>
      </div>
    );

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("overview") },
    { key: "contributions", label: t("speeches") },
    { key: "votes", label: t("votes") },
    { key: "sources", label: t("sources") },
  ];

  return (
    <div className="member-page">
      <div className="member-hero">
        <div className="member-hero__avatar">
          <MemberAvatar memberId={member.id} name={member.name} imageUrl={member.imageUrl} size="lg" />
        </div>
        <div className="member-hero__info">
          <h1 className="member-hero__name">{member.name}</h1>
          <p className="member-hero__meta">
            <span className="party-badge">{member.party ?? t("unknown")}</span>
            {" · "}
            <span>{member.areaName ?? ""}</span>
          </p>
          {member.profileUrl && (
            <a href={member.profileUrl} target="_blank" rel="noreferrer noopener" className="source-link">
              Senedd profile ↗
            </a>
          )}
        </div>
        <div className="member-hero__actions">
          <button
            className="btn btn--secondary btn--sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
          >
            {refreshing ? t("refreshing") : t("refreshData")}
          </button>
        </div>
      </div>

      <nav className="tab-nav" aria-label="Member sections">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className={`tab-nav__tab${tab === key ? " tab-nav__tab--active" : ""}`}
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="tab-panel" aria-label={t("overview")}>
          <dl className="member-stats">
            <div className="member-stats__item">
              <dt>{t("totalSpeeches")}</dt>
              <dd>{participation?.totalContributions ?? "—"}</dd>
            </div>
            <div className="member-stats__item">
              <dt>{t("totalVotes")}</dt>
              <dd>{participation?.totalVotes ?? "—"}</dd>
            </div>
            <div className="member-stats__item">
              <dt>{t("party")}</dt>
              <dd>{member.party ?? t("unknown")}</dd>
            </div>
            <div className="member-stats__item">
              <dt>{t("area")}</dt>
              <dd>{member.areaName ?? t("unknown")}</dd>
            </div>
          </dl>

          {participation?.topTopics && participation.topTopics.length > 0 && (
            <div className="topics-section">
              <h2 className="section-title">{t("topTopics")}</h2>
              <ul className="topic-list">
                {participation.topTopics.map((topic) => (
                  <li key={topic} className="topic-chip">{topic}</li>
                ))}
              </ul>
              {participation.topicBreakdown.length > 0 && (
                <>
                  <h3 className="section-title section-title--sm">{t("topicBreakdown")}</h3>
                  <ul className="topic-breakdown">
                    {participation.topicBreakdown.slice(0, 8).map(({ topic, count }) => (
                      <li key={topic} className="topic-breakdown__item">
                        <span className="topic-breakdown__label">{topic}</span>
                        <span className="topic-breakdown__count">{count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "contributions" && (
        <section className="tab-panel" aria-label={t("speeches")}>
          {loadingParticipation && page === 0
            ? <p className="loading-text">{t("loading")}</p>
            : participation?.contributions.length === 0
              ? <p className="empty-state">{t("noSpeeches")}</p>
              : (
                <>
                  <ul className="speech-list">
                    {participation?.contributions.map((c) => (
                      <SpeechCard key={c.id} item={c} locale={locale} />
                    ))}
                  </ul>
                  {participation && participation.contributions.length < participation.totalContributions && (
                    <div className="pagination">
                      <button
                        className="btn btn--secondary"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={loadingParticipation}
                      >
                        {loadingParticipation ? t("loading") : t("loadMore")}
                      </button>
                    </div>
                  )}
                </>
              )
          }
        </section>
      )}

      {tab === "votes" && (
        <section className="tab-panel" aria-label={t("votes")}>
          {loadingParticipation && page === 0
            ? <p className="loading-text">{t("loading")}</p>
            : participation?.votes.length === 0
              ? <p className="empty-state">{t("noVotes")}</p>
              : (
                <>
                  <ul className="vote-list">
                    {participation?.votes.map((v) => (
                      <VoteCard key={v.id} item={v} locale={locale} />
                    ))}
                  </ul>
                  {participation && participation.votes.length < participation.totalVotes && (
                    <div className="pagination">
                      <button
                        className="btn btn--secondary"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={loadingParticipation}
                      >
                        {loadingParticipation ? t("loading") : t("loadMore")}
                      </button>
                    </div>
                  )}
                </>
              )
          }
        </section>
      )}

      {tab === "sources" && (
        <section className="tab-panel" aria-label={t("sources")}>
          <h2 className="section-title">Data sources for {member.name}</h2>
          <ul className="source-links">
            <li>
              <a
                href="https://www.theyworkforyou.com/senedd/"
                target="_blank" rel="noreferrer noopener"
                className="source-link"
              >
                TheyWorkForYou – Welsh Senedd ↗
              </a>
            </li>
            <li>
              <a
                href="https://record.senedd.wales/"
                target="_blank" rel="noreferrer noopener"
                className="source-link"
              >
                Senedd Record of Proceedings ↗
              </a>
            </li>
            {member.profileUrl && (
              <li>
                <a
                  href={member.profileUrl}
                  target="_blank" rel="noreferrer noopener"
                  className="source-link"
                >
                  Senedd Member Profile ↗
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
