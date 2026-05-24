import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api";
import type {
  InternshipCompany,
  InternshipCompanyDetailResponse,
  InternshipManualBucket,
  InternshipPosting,
} from "../lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};
const INTERNSHIPS_COMPANY_PREFS_KEY = "personal-internships-company-prefs";

type InternshipCompanySidebarPrefs = {
  favoriteIds: number[];
  orderedIds: number[];
};

const DEFAULT_INTERNSHIPS_COMPANY_PREFS: InternshipCompanySidebarPrefs = {
  favoriteIds: [],
  orderedIds: [],
};

export function InternshipsPage({ timeZone }: { timeZone: string }) {
  const [companies, setCompanies] = useState<InternshipCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<InternshipCompanyDetailResponse | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingPostings, setLoadingPostings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPostingId, setUpdatingPostingId] = useState<number | null>(null);
  const [companySidebarPrefs, setCompanySidebarPrefs] = useState<InternshipCompanySidebarPrefs>(
    () => getStoredInternshipCompanyPrefs(),
  );
  const [error, setError] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCompanies() {
      try {
        const response = await api.getInternshipCompanies();
        if (!active) {
          return;
        }
        setCompanies(response.companies);
        setSelectedCompanyId((current) => current ?? response.companies[0]?.id ?? null);
      } catch (caught) {
        if (!active) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load tracked companies.");
      } finally {
        if (active) {
          setLoadingCompanies(false);
        }
      }
    }

    void loadCompanies();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedCompanyId == null) {
      setDetail(null);
      return;
    }

    let active = true;
    setLoadingPostings(true);

    api
      .getInternshipPostings(selectedCompanyId)
      .then((response) => {
        if (!active) {
          return;
        }
        setDetail(response);
        setError(null);
      })
      .catch((caught) => {
        if (!active) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load postings.");
      })
      .finally(() => {
        if (active) {
          setLoadingPostings(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedCompanyId]);

  useEffect(() => {
    if (companies.length === 0) return;
    setCompanySidebarPrefs((current) => reconcileCompanySidebarPrefs(current, companies));
  }, [companies]);

  useEffect(() => {
    window.localStorage.setItem(INTERNSHIPS_COMPANY_PREFS_KEY, JSON.stringify(companySidebarPrefs));
  }, [companySidebarPrefs]);

  useEffect(() => {
    if (companies.length === 0) {
      return;
    }
    if (selectedCompanyId != null && companies.some((company) => company.id === selectedCompanyId)) {
      return;
    }
    setSelectedCompanyId(companies[0]?.id ?? null);
  }, [companies, selectedCompanyId]);

  async function refreshSelectedCompany() {
    if (selectedCompanyId == null) {
      return;
    }

    setRefreshing(true);
    try {
      const response = await api.fetchInternshipPostings(selectedCompanyId);
      setDetail(response);
      const nextCompanies = await api.getInternshipCompanies();
      setCompanies(nextCompanies.companies);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh postings.");
    } finally {
      setRefreshing(false);
    }
  }

  async function updatePostingBucket(postingId: number, nextBucket: InternshipManualBucket) {
    setUpdatingPostingId(postingId);
    try {
      const response = await api.updateInternshipPostingBucket(postingId, nextBucket);
      setDetail(response);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update posting bucket.");
    } finally {
      setUpdatingPostingId(null);
    }
  }

  async function toggleApplied(postingId: number) {
    setUpdatingPostingId(postingId);
    try {
      const response = await api.toggleInternshipPostingApplied(postingId);
      setDetail(response);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update applied status.");
    } finally {
      setUpdatingPostingId(null);
    }
  }

  async function generateSummary(postingId: number) {
    setUpdatingPostingId(postingId);
    try {
      const response = await api.summarizeInternshipPosting(postingId);
      setDetail(response);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate summary.");
    } finally {
      setUpdatingPostingId(null);
    }
  }

  function toggleCompanyFavorite(companyId: number) {
    setCompanySidebarPrefs((current) => {
      const alreadyFavorite = current.favoriteIds.includes(companyId);
      return {
        ...current,
        favoriteIds: alreadyFavorite
          ? current.favoriteIds.filter((id) => id !== companyId)
          : [companyId, ...current.favoriteIds],
      };
    });
  }

  function onCompanyDragStart(_e: DragEvent, index: number) {
    dragIndexRef.current = index;
  }

  function onCompanyDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndexRef.current = index;
  }

  function onCompanyDrop(e: DragEvent) {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = dragOverIndexRef.current;
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
    if (from === null || to === null || from === to) return;
    setCompanySidebarPrefs((current) => {
      const visualOrder = orderedCompanies.map((c) => c.id);
      const next = [...visualOrder];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, orderedIds: next };
    });
  }

  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) ?? detail?.company ?? null;
  const orderedCompanies = useMemo(() => {
    const ordered = orderCompaniesBySavedIds(companies, companySidebarPrefs.orderedIds);
    const orderRank = new Map(ordered.map((company, index) => [company.id, index]));
    return [...ordered].sort((left, right) => {
      const leftFavorite = companySidebarPrefs.favoriteIds.includes(left.id);
      const rightFavorite = companySidebarPrefs.favoriteIds.includes(right.id);
      if (leftFavorite !== rightFavorite) {
        return leftFavorite ? -1 : 1;
      }
      return (orderRank.get(left.id) ?? 0) - (orderRank.get(right.id) ?? 0);
    });
  }, [companies, companySidebarPrefs.favoriteIds, companySidebarPrefs.orderedIds]);
  // A posting is eligible if it passed automatic stage-one filters OR was manually
  // placed in any explicit bucket — that way a post you star or restore is never invisible.
  const eligiblePostings = (detail?.postings ?? []).filter(
    (posting) => posting.passesStageOne || posting.manualBucket !== "",
  );
  const appliedPostings = (detail?.postings ?? []).filter((posting) => posting.isApplied);
  const hiddenPostings = eligiblePostings.filter((posting) => posting.manualBucket === "hidden");
  const visibleEligiblePostings = eligiblePostings.filter((posting) => posting.manualBucket !== "hidden");
  const primePostings = visibleEligiblePostings.filter(
    (posting) => !posting.isApplied && (posting.manualBucket === "prime" || (posting.manualBucket === "" && posting.isAutoPrime)),
  );
  const otherPostings = visibleEligiblePostings.filter(
    (posting) => !posting.isApplied && (posting.manualBucket === "not_prime" || (posting.manualBucket === "" && !posting.isAutoPrime)),
  );

  return (
    <section className="page internships-page">
      <motion.div className="page-heading" {...reveal}>
        <div>
          <h2 className="hero-title">Internships</h2>
        </div>
      </motion.div>

      <div className="content-grid internships-layout">
        <motion.section className="surface-card internships-company-panel" {...reveal}>
          <div className="surface-header">
            <div>
              <h3>Tracked companies</h3>
            </div>
          </div>

          {loadingCompanies ? (
            <div className="internships-empty">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="internships-empty">No tracked companies yet.</div>
          ) : (
            <div
              className="internships-company-grid"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onCompanyDrop(e)}
            >
              {orderedCompanies.map((company, index) => (
                <InternshipCompanyCard
                  key={company.id}
                  company={company}
                  active={company.id === selectedCompanyId}
                  isFavorite={companySidebarPrefs.favoriteIds.includes(company.id)}
                  onSelect={() => setSelectedCompanyId(company.id)}
                  onToggleFavorite={() => toggleCompanyFavorite(company.id)}
                  onDragStart={(e) => onCompanyDragStart(e, index)}
                  onDragOver={(e) => onCompanyDragOver(e, index)}
                />
              ))}
            </div>
          )}
        </motion.section>

        <motion.section className="surface-card internships-results-panel" {...reveal}>
          <div className="surface-header internships-results-header">
            <div>
              <h3>{selectedCompany?.name ?? "Internship board"}</h3>
              <p>
                {selectedCompany
                  ? `${selectedCompany.sourceType} board · ${selectedCompany.sourceKey}`
                  : "Pick a company to load postings."}
              </p>
              {selectedCompany?.careersUrl ? (
                <a
                  className="internships-company-site-link"
                  href={selectedCompany.careersUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open careers site
                  <ArrowUpRight size={14} />
                </a>
              ) : null}
            </div>
            <button
              type="button"
              className="primary-button internships-refresh-button"
              onClick={() => void refreshSelectedCompany()}
              disabled={selectedCompanyId == null || refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Fetch live postings"}
            </button>
          </div>

          {selectedCompany ? (
            <div className="internships-summary-strip">
              <article className="internships-summary-card">
                <span className="internships-summary-label">Eligible internships</span>
                <strong>{visibleEligiblePostings.length}</strong>
              </article>
              <article className="internships-summary-card">
                <span className="internships-summary-label">Prime results</span>
                <strong>{primePostings.length}</strong>
              </article>
              <article className="internships-summary-card">
                <span className="internships-summary-label">Last sync</span>
                <strong>{formatTimestamp(selectedCompany.lastFetchedAt, timeZone)}</strong>
              </article>
            </div>
          ) : null}

          {selectedCompany?.lastFetchError ? (
            <div className="internships-error-banner">{selectedCompany.lastFetchError}</div>
          ) : null}
          {error ? <div className="internships-error-banner">{error}</div> : null}

          <div className="internships-results-copy">
            {visibleEligiblePostings.length > 0 ? (
              <p>
                <span className="internships-results-count">{primePostings.length}</span> prime results
              </p>
            ) : null}
          </div>

          {loadingPostings ? (
            <div className="internships-empty">Loading stored postings...</div>
          ) : visibleEligiblePostings.length === 0 ? (
            <div className="internships-empty">
              <Sparkles size={16} />
              <span>
                {hiddenPostings.length > 0
                  ? "All eligible internship postings are currently hidden."
                  : "No eligible internship postings were found with the current rules."}
              </span>
            </div>
          ) : (
            <>
              {primePostings.length > 0 ? (
                <div className="internships-postings-list">
                  {primePostings.map((posting) => (
                    <InternshipPostingCard
                      key={posting.id}
                      posting={posting}
                      updating={updatingPostingId === posting.id}
                      onSetBucket={(bucket) => void updatePostingBucket(posting.id, bucket)}
                      onToggleApplied={() => void toggleApplied(posting.id)}
                      onGenerateSummary={() => void generateSummary(posting.id)}
                      allowHide={false}
                    />
                  ))}
                </div>
              ) : (
                <div className="internships-empty">
                  <span>🎉 No new postings that you haven't already applied to!</span>
                </div>
              )}

              {appliedPostings.length > 0 ? (
                <details className="internships-other-details internships-applied-details">
                  <summary>
                    Applied at {selectedCompany?.name ?? "this company"} ({appliedPostings.length})
                  </summary>
                  <div className="internships-postings-list internships-postings-list-secondary">
                    {appliedPostings.map((posting) => (
                      <InternshipPostingCard
                        key={posting.id}
                        posting={posting}
                        updating={updatingPostingId === posting.id}
                        onSetBucket={(bucket) => void updatePostingBucket(posting.id, bucket)}
                        onToggleApplied={() => void toggleApplied(posting.id)}
                        onGenerateSummary={() => void generateSummary(posting.id)}
                        allowHide={false}
                      />
                    ))}
                  </div>
                </details>
              ) : null}

              {otherPostings.length > 0 ? (
                <details className="internships-other-details internships-not-prime-details">
                  <summary>
                    Other internships at {selectedCompany?.name ?? "this company"} ({otherPostings.length})
                  </summary>
                  <div className="internships-postings-list internships-postings-list-secondary">
                    {otherPostings.map((posting) => (
                      <InternshipPostingCard
                        key={posting.id}
                        posting={posting}
                        updating={updatingPostingId === posting.id}
                        onSetBucket={(bucket) => void updatePostingBucket(posting.id, bucket)}
                        onToggleApplied={() => void toggleApplied(posting.id)}
                        onGenerateSummary={() => void generateSummary(posting.id)}
                        allowHide
                      />
                    ))}
                  </div>
                </details>
              ) : null}

              {hiddenPostings.length > 0 ? (
                <details className="internships-other-details internships-hidden-details">
                  <summary>
                    Hidden internships at {selectedCompany?.name ?? "this company"} ({hiddenPostings.length})
                  </summary>
                  <div className="internships-postings-list internships-postings-list-secondary">
                    {hiddenPostings.map((posting) => (
                      <InternshipPostingCard
                        key={posting.id}
                        posting={posting}
                        updating={updatingPostingId === posting.id}
                        onSetBucket={(bucket) => void updatePostingBucket(posting.id, bucket)}
                        onToggleApplied={() => void toggleApplied(posting.id)}
                        onGenerateSummary={() => void generateSummary(posting.id)}
                        allowHide={false}
                        allowRestore
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          )}
        </motion.section>
      </div>
    </section>
  );
}

function InternshipCompanyCard({
  company,
  active,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onDragStart,
  onDragOver,
}: {
  company: InternshipCompany;
  active: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDragStart?: (e: DragEvent<HTMLElement>) => void;
  onDragOver?: (e: DragEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className={`internships-company-card ${active ? "active" : ""} ${isFavorite ? "favorite" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
    >
      <button type="button" className="internships-company-select" onClick={onSelect}>
        <div className="internships-company-card-top">
          <span className="internships-company-name">{company.name}</span>
        </div>
        <div className="internships-company-card-meta">
          <span>{company.internshipMatches} internship{company.internshipMatches === 1 ? "" : "s"}</span>
          <span>{company.activePostings} live role{company.activePostings === 1 ? "" : "s"}</span>
        </div>
      </button>

      <div className="internships-company-controls">
        <button
          type="button"
          className={`internships-company-icon ${isFavorite ? "active" : ""}`}
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Remove company from favorites" : "Add company to favorites"}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={14} />
        </button>
      </div>
    </article>
  );
}

function InternshipPostingCard({
  posting,
  updating,
  onSetBucket,
  onToggleApplied,
  onGenerateSummary,
  allowHide = false,
  allowRestore = false,
}: {
  posting: InternshipPosting;
  updating: boolean;
  onSetBucket: (bucket: InternshipManualBucket) => void;
  onToggleApplied: () => void;
  onGenerateSummary: () => void;
  allowHide?: boolean;
  allowRestore?: boolean;
}) {
  return (
    <article className="internship-posting-card">
      <div className="internship-posting-card-top">
        <div>
          <h4>{posting.title}</h4>
          <div className="internship-posting-badges">
            {posting.isInternship ? (
              <span className="internship-pill internship-pill-match">
                <Sparkles size={13} />
                Internship match
              </span>
            ) : null}
            {posting.team ? (
              <span className="internship-pill">
                <Building2 size={13} />
                {posting.team}
              </span>
            ) : null}
            {posting.employmentType ? (
              <span className="internship-pill">
                <BriefcaseBusiness size={13} />
                {posting.employmentType}
              </span>
            ) : null}
          </div>
        </div>
        <div className="internship-posting-right-rail">
          <div className="internship-posting-actions" aria-label="Posting controls">
            <button
              type="button"
              className={`internship-icon-button ${posting.manualBucket === "prime" || (posting.manualBucket === "" && posting.isAutoPrime) ? "active" : ""}`}
              onClick={() => onSetBucket(posting.manualBucket === "prime" || (posting.manualBucket === "" && posting.isAutoPrime) ? "not_prime" : "prime")}
              disabled={updating}
              aria-label="Move posting to prime results"
              data-tooltip={posting.manualBucket === "prime" || (posting.manualBucket === "" && posting.isAutoPrime) ? "Remove from prime" : "Mark as prime"}
            >
              <Star size={14} />
            </button>
            {allowHide ? (
              <button
                type="button"
                className="internship-icon-button danger"
                onClick={() => onSetBucket("hidden")}
                disabled={updating}
                aria-label="Hide posting"
                data-tooltip="Hide posting"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
            {allowRestore ? (
              <button
                type="button"
                className="internship-icon-button"
                onClick={() => onSetBucket("")}
                disabled={updating}
                aria-label="Restore posting"
                data-tooltip="Move to other internships"
              >
                <Undo2 size={14} />
              </button>
            ) : null}
          </div>
          <a
            className="secondary-button internship-posting-link"
            href={posting.url}
            target="_blank"
            rel="noreferrer"
          >
            Open posting
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className="internship-posting-meta">
        {posting.location ? <span>{posting.location}</span> : null}
        {posting.firstPublishedAt ? <span>Published {formatDate(posting.firstPublishedAt)}</span> : null}
      </div>

      {posting.aiSummary ? (
        <p className="internship-posting-preview">{posting.aiSummary}</p>
      ) : posting.descriptionText ? (
        <button
          type="button"
          className="secondary-button internship-generate-summary-button"
          onClick={onGenerateSummary}
          disabled={updating}
        >
          Generate AI summary
        </button>
      ) : null}

      <button
        type="button"
        className={`internship-applied-button ${posting.isApplied ? "applied" : ""}`}
        onClick={onToggleApplied}
        disabled={updating}
      >
        <Check size={15} />
        {posting.isApplied ? "Applied" : "Mark as applied"}
      </button>
    </article>
  );
}

function formatTimestamp(value: string | null | undefined, timeZone: string) {
  if (!value) {
    return "Not fetched yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStoredInternshipCompanyPrefs(): InternshipCompanySidebarPrefs {
  if (typeof window === "undefined") {
    return DEFAULT_INTERNSHIPS_COMPANY_PREFS;
  }

  const stored = window.localStorage.getItem(INTERNSHIPS_COMPANY_PREFS_KEY);
  if (!stored) {
    return DEFAULT_INTERNSHIPS_COMPANY_PREFS;
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      favoriteIds: Array.isArray(parsed?.favoriteIds)
        ? parsed.favoriteIds.filter((value: unknown) => typeof value === "number")
        : [],
      orderedIds: Array.isArray(parsed?.orderedIds)
        ? parsed.orderedIds.filter((value: unknown) => typeof value === "number")
        : parsed?.sourceOrders && typeof parsed.sourceOrders === "object" && !Array.isArray(parsed.sourceOrders)
          ? Object.values(parsed.sourceOrders)
              .flatMap((value) => (Array.isArray(value) ? value : []))
              .filter((value: unknown) => typeof value === "number")
          : [],
    };
  } catch {
    return DEFAULT_INTERNSHIPS_COMPANY_PREFS;
  }
}

function reconcileCompanySidebarPrefs(
  current: InternshipCompanySidebarPrefs,
  companies: InternshipCompany[],
): InternshipCompanySidebarPrefs {
  const validIds = new Set(companies.map((company) => company.id));
  const nextFavoriteIds = current.favoriteIds.filter((id) => validIds.has(id));
  const nextOrderedIds = normalizeOrderedIds(current.orderedIds, companies.map((company) => company.id));

  return {
    favoriteIds: nextFavoriteIds,
    orderedIds: nextOrderedIds,
  };
}

function normalizeOrderedIds(savedIds: number[], actualIds: number[]) {
  const actualIdSet = new Set(actualIds);
  const ordered = savedIds.filter((id) => actualIdSet.has(id));
  const missing = actualIds.filter((id) => !ordered.includes(id));
  // New companies (not yet in savedIds) are always appended at the bottom.
  // This means adding companies to the backend seed list won't reset anyone's saved order.
  return [...ordered, ...missing];
}

function orderCompaniesBySavedIds(companies: InternshipCompany[], savedIds: number[]) {
  const order = normalizeOrderedIds(savedIds, companies.map((company) => company.id));
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...companies].sort((left, right) => {
    const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.name.localeCompare(right.name);
  });
}
