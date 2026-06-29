import { motion } from "framer-motion";
import { BookmarkCheck, ExternalLink, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { openUrl } from "../lib/openUrl";
import type { DiscoverBucket, DiscoverPosting, InternshipManualBucket, ScrapeAllResult } from "../lib/types";

const BUCKET_LABELS: Record<DiscoverBucket, string> = {
  swe: "SWE",
  ml_ai: "ML / AI",
  robotics: "Robotics",
  climate: "Climate",
  data: "Data",
};

const BUCKET_COLORS: Record<DiscoverBucket, string> = {
  swe: "tag-swe",
  ml_ai: "tag-ml",
  robotics: "tag-robotics",
  climate: "tag-climate",
  data: "tag-data",
};

const ALL_BUCKETS: DiscoverBucket[] = ["swe", "ml_ai", "robotics", "climate", "data"];

function formatDateAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.floor(diffDays / 30);
  return `${months}mo ago`;
}

function PostingCard({
  posting,
  onSave,
  onDismiss,
  onUnsave,
}: {
  posting: DiscoverPosting;
  onSave: (id: number) => void;
  onDismiss: (id: number) => void;
  onUnsave: (id: number) => void;
}) {
  const isSaved = posting.manualBucket === "saved";
  const isDismissed = posting.manualBucket === "dismissed";
  const dateStr = posting.firstPublishedAt ?? posting.updatedAtRemote ?? posting.fetchedAt;

  if (isDismissed) return null;

  return (
    <div className={`internship-card ${isSaved ? "internship-card-saved" : ""}`}>
      <div className="internship-card-header">
        <div className="internship-card-meta">
          <span className="internship-card-company">{posting.companyName}</span>
          {dateStr && (
            <span className="internship-card-date">{formatDateAgo(dateStr)}</span>
          )}
        </div>
        <div className="internship-card-actions">
          {isSaved ? (
            <button
              className="internship-action-btn internship-action-saved"
              onClick={() => onUnsave(posting.id)}
              title="Unsave"
            >
              <BookmarkCheck size={13} />
            </button>
          ) : (
            <button
              className="internship-action-btn"
              onClick={() => onSave(posting.id)}
              title="Save"
            >
              <BookmarkCheck size={13} />
            </button>
          )}
          <button
            className="internship-action-btn internship-action-dismiss"
            onClick={() => onDismiss(posting.id)}
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="internship-card-title">
        <button
          className="internship-title-link"
          onClick={() => posting.url && void openUrl(posting.url)}
          disabled={!posting.url}
        >
          {posting.title}
          {posting.url && <ExternalLink size={11} className="internship-title-icon" />}
        </button>
      </div>

      {posting.location && (
        <div className="internship-card-location">{posting.location}</div>
      )}

      {posting.matchTags.length > 0 && (
        <div className="internship-card-tags">
          {posting.matchTags.map((tag) => (
            <span key={tag} className={`internship-tag ${BUCKET_COLORS[tag]}`}>
              {BUCKET_LABELS[tag]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const DAY_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "All", value: 365 },
];

export function InternshipsPage() {
  const [matched, setMatched] = useState<DiscoverPosting[]>([]);
  const [unmatched, setUnmatched] = useState<DiscoverPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeAllResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<DiscoverBucket | "all">("all");
  const [days, setDays] = useState(14);

  async function loadDiscover(d = days) {
    try {
      const data = await api.discoverInternships(d);
      setMatched(data.matched);
      setUnmatched(data.unmatched);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load postings");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setScraping(true);
    setScrapeResult(null);
    setError(null);
    try {
      const result = await api.scrapeAllInternships();
      setScrapeResult(result);
      await loadDiscover();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  useEffect(() => {
    void loadDiscover(days);
  }, [days]);

  function updatePostingStatus(id: number, status: InternshipManualBucket) {
    const update = (list: DiscoverPosting[]) =>
      list.map((p) => (p.id === id ? { ...p, manualBucket: status } : p));
    setMatched((prev) => update(prev));
    setUnmatched((prev) => update(prev));
    void api.updateInternshipPostingStatus(id, status);
  }

  const handleSave = (id: number) => updatePostingStatus(id, "saved");
  const handleDismiss = (id: number) => updatePostingStatus(id, "dismissed");
  const handleUnsave = (id: number) => updatePostingStatus(id, "");

  const filteredMatched =
    activeBucket === "all"
      ? matched
      : matched.filter((p) => p.matchTags.includes(activeBucket));

  const visibleMatched = filteredMatched.filter((p) => p.manualBucket !== "dismissed");
  const visibleUnmatched = unmatched.filter((p) => p.manualBucket !== "dismissed");
  const savedCount = matched.filter((p) => p.manualBucket === "saved").length;

  return (
    <section className="page">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="internships-topbar">
          <h2 className="hero-title hover-underline-title">Internships.</h2>
          <div className="internships-topbar-right">
            {scrapeResult && (
              <span className="internships-scrape-summary">
                {scrapeResult.successCount}/{scrapeResult.totalCompanies} companies
                {scrapeResult.errorCount > 0 && ` · ${scrapeResult.errorCount} errors`}
              </span>
            )}
            {savedCount > 0 && (
              <span className="internships-saved-badge">{savedCount} saved</span>
            )}
            <div className="internships-day-filter">
              {DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`internships-day-btn ${days === opt.value ? "active" : ""}`}
                  onClick={() => setDays(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              className="internships-refresh-btn"
              onClick={() => void handleRefresh()}
              disabled={scraping}
            >
              <RefreshCw size={14} className={scraping ? "spinning" : ""} />
              {scraping ? "Scraping…" : "Refresh"}
            </button>
          </div>
        </div>
      </motion.div>

      {error && <div className="internships-error">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <p>Loading postings…</p>
        </div>
      ) : (
        <div className="internships-layout">
          {/* Left panel — unmatched */}
          <div className="internships-panel internships-panel-unmatched">
            <div className="internships-panel-header">
              <h3>Unmatched</h3>
              <span className="internships-panel-count">{visibleUnmatched.length}</span>
            </div>
            <div className="internships-panel-body">
              {visibleUnmatched.length === 0 ? (
                <p className="internships-empty">No unmatched postings.</p>
              ) : (
                visibleUnmatched.map((p) => (
                  <PostingCard
                    key={p.id}
                    posting={p}
                    onSave={handleSave}
                    onDismiss={handleDismiss}
                    onUnsave={handleUnsave}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right panel — matched */}
          <div className="internships-panel internships-panel-matched">
            <div className="internships-panel-header">
              <h3>Matched</h3>
              <span className="internships-panel-count">{visibleMatched.length}</span>
            </div>

            <div className="internships-bucket-tabs">
              <button
                className={`internships-bucket-tab ${activeBucket === "all" ? "active" : ""}`}
                onClick={() => setActiveBucket("all")}
              >
                All
              </button>
              {ALL_BUCKETS.map((bucket) => {
                const count = matched.filter(
                  (p) => p.matchTags.includes(bucket) && p.manualBucket !== "dismissed",
                ).length;
                return (
                  <button
                    key={bucket}
                    className={`internships-bucket-tab ${activeBucket === bucket ? "active" : ""}`}
                    onClick={() => setActiveBucket(bucket)}
                  >
                    {BUCKET_LABELS[bucket]}
                    {count > 0 && (
                      <span className="internships-bucket-tab-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="internships-panel-body">
              {visibleMatched.length === 0 ? (
                <p className="internships-empty">
                  {activeBucket === "all"
                    ? "No matched postings yet. Hit Refresh to scrape."
                    : `No ${BUCKET_LABELS[activeBucket]} postings matched.`}
                </p>
              ) : (
                visibleMatched.map((p) => (
                  <PostingCard
                    key={p.id}
                    posting={p}
                    onSave={handleSave}
                    onDismiss={handleDismiss}
                    onUnsave={handleUnsave}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
