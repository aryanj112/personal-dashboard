import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import type { ChangeEvent, FormEvent, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  NETWORKING_LOCATION_FILTER_ALL,
  NETWORKING_ROLE_FILTER_ALL,
  type NetworkingContact,
  type NetworkingLocation,
  type NetworkingOptionConfig,
  type PotentialConnect,
  type PotentialConnectStatus,
  type NetworkingSortKey,
  FollowUpType,
  formatNetworkingLocation,
  getNetworkingCities,
  InteractionType,
  NetworkingRole,
  getDaysSince,
  getDaysUntil,
  getNetworkingCompanies,
  getNetworkingLocations,
  getNetworkingRegions,
  getNetworkingRoles,
  getOverdueNetworkingContacts,
  sortNetworkingContacts,
} from "../lib/networking";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

const SORT_OPTIONS: { label: string; value: NetworkingSortKey }[] = [
  { label: "Needs attention", value: "attention" },
  { label: "Last contact", value: "last_contact" },
  { label: "Next follow-up", value: "follow_up" },
  { label: "Company", value: "company" },
  { label: "Name", value: "name" },
];

const POTENTIAL_STATUS_OPTIONS: Array<{ label: string; value: PotentialConnectStatus | "all" }> = [
  { label: "Pending", value: "pending" },
  { label: "Sent", value: "sent" },
  { label: "Replied", value: "replied" },
  { label: "Converted", value: "converted_to_network" },
  { label: "All statuses", value: "all" },
];

export function NetworkingPage({ options }: { options: NetworkingOptionConfig }) {
  const [companyFilter, setCompanyFilter] = useState("All companies");
  const [locationFilter, setLocationFilter] = useState(NETWORKING_LOCATION_FILTER_ALL);
  const [roleFilter, setRoleFilter] = useState(NETWORKING_ROLE_FILTER_ALL);
  const [sortKey, setSortKey] = useState<NetworkingSortKey>("last_contact");
  const [contacts, setContacts] = useState<NetworkingContact[]>([]);
  const [potentialConnects, setPotentialConnects] = useState<PotentialConnect[]>([]);
  const [potentialCompanyFilter, setPotentialCompanyFilter] = useState("All companies");
  const [potentialStatusFilter, setPotentialStatusFilter] = useState<PotentialConnectStatus | "all">("pending");
  const [potentialSearch, setPotentialSearch] = useState("");
  const [selectedPotentialConnectId, setSelectedPotentialConnectId] = useState<number | null>(null);
  const [potentialDraft, setPotentialDraft] = useState<PotentialConnect | null>(null);
  const [potentialBusy, setPotentialBusy] = useState(false);
  const [potentialCopyState, setPotentialCopyState] = useState<"idle" | "copied">("idle");
  const [potentialSelectionLength, setPotentialSelectionLength] = useState(0);
  const [showPotentialCompanyEditor, setShowPotentialCompanyEditor] = useState(false);
  const [showCompanyCounts, setShowCompanyCounts] = useState(false);
  const [draftContact, setDraftContact] = useState<NetworkingContact | null>(null);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [newInteractionDraft, setNewInteractionDraft] = useState<{ date: string; type: string; summary: string } | null>(null);
  const companies = useMemo(() => getNetworkingCompanies(contacts), [contacts]);
  const potentialCompanies = useMemo(
    () => ["All companies", ...Array.from(new Set(potentialConnects.map((connect) => connect.company))).sort()],
    [potentialConnects],
  );
  const locations = useMemo(() => getNetworkingLocations(contacts), [contacts]);
  const roles = useMemo(() => getNetworkingRoles(contacts), [contacts]);
  const regionOptions = useMemo(() => getNetworkingRegions(options.locationOptions), [options.locationOptions]);
  const cityOptions = useMemo(
    () => getNetworkingCities(draftContact?.location.region ?? "", options.locationOptions),
    [draftContact?.location.region, options.locationOptions],
  );

  const filteredContacts = useMemo(() => {
    const subset = contacts.filter((contact) => {
      const matchesCompany =
        companyFilter === "All companies" || contact.company === companyFilter;
      const matchesLocation =
        locationFilter === NETWORKING_LOCATION_FILTER_ALL ||
        formatNetworkingLocation(contact.location) === locationFilter;
      const matchesRole =
        roleFilter === NETWORKING_ROLE_FILTER_ALL || contact.role === roleFilter;
      return matchesCompany && matchesLocation && matchesRole;
    });
    return sortNetworkingContacts(subset, sortKey);
  }, [companyFilter, contacts, locationFilter, roleFilter, sortKey]);

  const overdueContacts = useMemo(
    () =>
      getOverdueNetworkingContacts(
        contacts.filter((contact) => {
          const matchesCompany =
            companyFilter === "All companies" || contact.company === companyFilter;
          const matchesLocation =
            locationFilter === NETWORKING_LOCATION_FILTER_ALL ||
            formatNetworkingLocation(contact.location) === locationFilter;
          const matchesRole =
            roleFilter === NETWORKING_ROLE_FILTER_ALL || contact.role === roleFilter;
          return matchesCompany && matchesLocation && matchesRole;
        }),
      ),
    [companyFilter, contacts, locationFilter, roleFilter],
  );
  const filteredPotentialConnects = useMemo(() => {
    const search = potentialSearch.trim().toLowerCase();
    return potentialConnects.filter((connect) => {
      const matchesCompany =
        potentialCompanyFilter === "All companies" || connect.company === potentialCompanyFilter;
      const matchesStatus =
        potentialStatusFilter === "all" || connect.status === potentialStatusFilter;
      const matchesSearch =
        search.length === 0 ||
        [connect.name, connect.company, connect.role, connect.focusArea, connect.connectionRequest]
          .join(" ")
          .toLowerCase()
          .includes(search);
      return matchesCompany && matchesStatus && matchesSearch;
    });
  }, [
    potentialCompanyFilter,
    potentialConnects,
    potentialSearch,
    potentialStatusFilter,
  ]);
  const potentialStatusCounts = useMemo(() => {
    return potentialConnects.reduce<Record<string, number>>((accumulator, connect) => {
      accumulator[connect.status] = (accumulator[connect.status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [potentialConnects]);
  const potentialCompanyCounts = useMemo(() => {
    return Array.from(
      potentialConnects.reduce<Map<string, number>>((accumulator, connect) => {
        accumulator.set(connect.company, (accumulator.get(connect.company) ?? 0) + 1);
        return accumulator;
      }, new Map()),
    ).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [potentialConnects]);
  const repliedPotentialConnects = useMemo(
    () => potentialConnects.filter((connect) => connect.status === "replied"),
    [potentialConnects],
  );

  async function loadPotentialConnects() {
    const response = await api.getPotentialConnects();
    setPotentialConnects(response.potentialConnects);
    return response.potentialConnects;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      const [response, potentialResponse] = await Promise.all([
        api.getNetworking(),
        api.getPotentialConnects(),
      ]);
      if (!cancelled) {
        setContacts(response.contacts);
        setPotentialConnects(potentialResponse.potentialConnects);
      }
    }

    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (filteredPotentialConnects.length === 0) {
      setSelectedPotentialConnectId(null);
      setPotentialDraft(null);
      setPotentialSelectionLength(0);
      setShowPotentialCompanyEditor(false);
      return;
    }

    const selected = filteredPotentialConnects.find((connect) => connect.id === selectedPotentialConnectId);
    if (!selected) {
      setSelectedPotentialConnectId(filteredPotentialConnects[0].id);
      setPotentialDraft(filteredPotentialConnects[0]);
      setPotentialSelectionLength(0);
      setShowPotentialCompanyEditor(false);
      return;
    }

    setPotentialDraft((current) =>
      current && current.id === selected.id
        ? current
        : selected,
    );
    setPotentialSelectionLength(0);
    setShowPotentialCompanyEditor(false);
  }, [filteredPotentialConnects, selectedPotentialConnectId]);

  useEffect(() => {
    if (!draftContact) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEditor();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftContact]);

  useEffect(() => {
    if (!draftContact) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [draftContact]);

  function openExistingContact(contact: NetworkingContact) {
    setEditingContactId(contact.id);
    setDraftContact({ ...contact, interactions: [...contact.interactions] });
    setNewInteractionDraft(null);
  }

  function openNewContact() {
    const contact = createEmptyContact();
    setEditingContactId(contact.id);
    setDraftContact(contact);
    setNewInteractionDraft(null);
  }

  function closeEditor() {
    setEditingContactId(null);
    setDraftContact(null);
    setNewInteractionDraft(null);
  }

  function handleAddInteraction() {
    if (!draftContact || !newInteractionDraft || !newInteractionDraft.summary.trim()) return;
    setDraftContact({
      ...draftContact,
      interactions: [
        { id: -Date.now(), date: newInteractionDraft.date, type: newInteractionDraft.type, summary: newInteractionDraft.summary.trim() },
        ...draftContact.interactions,
      ],
    });
    setNewInteractionDraft(null);
  }

  function handleMarkFollowUpDone() {
    if (!draftContact) return;
    const today = getTodayString();
    setDraftContact({
      ...draftContact,
      lastContactDate: today,
      nextFollowUpDate: "",
      interactions: [
        { id: -Date.now(), date: today, type: draftContact.followUpType || InteractionType.Message, summary: "Follow-up completed" },
        ...draftContact.interactions,
      ],
    });
  }

  function handleDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setDraftContact((current) => {
      if (!current) {
        return current;
      }

      if (name.startsWith("location.")) {
        const locationKey = name.replace("location.", "") as keyof NetworkingLocation;
        const nextLocation = {
          ...current.location,
          [locationKey]: value,
        };

        if (locationKey === "region") {
          const nextCities = getNetworkingCities(value, options.locationOptions);
          if (!nextCities.includes(nextLocation.city)) {
            nextLocation.city = "";
          }
        }

        return {
          ...current,
          location: nextLocation,
        };
      }

      if (name === "phone") {
        return {
          ...current,
          phone: formatPhoneNumber(value),
        };
      }

      return { ...current, [name]: value };
    });
  }

  async function handleSaveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftContact) {
      return;
    }

    const normalizedContact = normalizeContact(draftContact);
    const payload = stripContactMeta(normalizedContact);
    const savedContact =
      normalizedContact.id === 0
        ? await api.createNetworkingContact(payload)
        : await api.updateNetworkingContact(normalizedContact.id, payload);

    setContacts((current) => {
      const exists = current.some((contact) => contact.id === savedContact.id);
      if (!exists) {
        return [savedContact, ...current];
      }

      return current.map((contact) =>
        contact.id === savedContact.id ? savedContact : contact,
      );
    });
    await loadPotentialConnects();
    closeEditor();
  }

  function openPotentialConnect(connect: PotentialConnect) {
    setSelectedPotentialConnectId(connect.id);
    setPotentialDraft(connect);
    setPotentialCopyState("idle");
  }

  function handlePotentialDraftChange(
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) {
    const { name, value } = event.target;
    setPotentialDraft((current) => (current ? { ...current, [name]: value } : current));
    if (name === "connectionRequest") {
      setPotentialSelectionLength(0);
    }
  }

  function handlePotentialMessageSelection(event: SyntheticEvent<HTMLTextAreaElement>) {
    const { selectionStart, selectionEnd } = event.currentTarget;
    setPotentialSelectionLength(Math.max(0, selectionEnd - selectionStart));
  }

  async function savePotentialConnect(patch?: Partial<PotentialConnect>) {
    if (!potentialDraft) {
      return null;
    }

    setPotentialBusy(true);
    try {
      const saved = await api.updatePotentialConnect(potentialDraft.id, {
        company: patch?.company ?? potentialDraft.company,
        connectionRequest: patch?.connectionRequest ?? potentialDraft.connectionRequest,
        status: patch?.status ?? potentialDraft.status,
        dateSent:
          patch?.dateSent !== undefined
            ? patch.dateSent
            : potentialDraft.dateSent,
        notes: patch?.notes ?? potentialDraft.notes,
      });
      const refreshed = await loadPotentialConnects();
      const refreshedConnect = refreshed.find((connect) => connect.id === saved.id) ?? saved;
      setPotentialDraft(refreshedConnect);
      return saved;
    } finally {
      setPotentialBusy(false);
    }
  }

  async function copyPotentialMessage() {
    if (!potentialDraft?.connectionRequest) {
      return;
    }
    await navigator.clipboard.writeText(potentialDraft.connectionRequest);
    setPotentialCopyState("copied");
  }

  async function handleSendPotentialConnect() {
    if (!potentialDraft) {
      return;
    }

    if (potentialDraft.linkedin) {
      window.open(potentialDraft.linkedin, "_blank", "noopener,noreferrer");
    }
    if (potentialDraft.connectionRequest) {
      await navigator.clipboard.writeText(potentialDraft.connectionRequest);
      setPotentialCopyState("copied");
    }
    await savePotentialConnect({
      status: "sent",
      dateSent: getTodayString(),
    });
  }

  async function updatePotentialStatus(status: PotentialConnectStatus) {
    if (!potentialDraft) {
      return;
    }
    await savePotentialConnect({
      status,
      dateSent:
        status === "sent"
          ? potentialDraft.dateSent || getTodayString()
          : potentialDraft.dateSent,
    });
  }

  function isPotentialConnectSaved(connect: PotentialConnect) {
    return contacts.some((contact) =>
      (connect.linkedin && contact.linkedin === connect.linkedin) ||
      (contact.name === connect.name && contact.company === connect.company),
    );
  }

  async function savePotentialConnectToNetwork(connect = potentialDraft) {
    if (!connect) {
      return;
    }

    const today = getTodayString();
    if (!isPotentialConnectSaved(connect)) {
      const payload = {
        name: connect.name,
        company: connect.company,
        role: connect.role || NetworkingRole.Other,
        tags: ["Replied"],
        email: "",
        phone: "",
        linkedin: connect.linkedin,
        location: {
          city: "",
          region: "",
        },
        notes: [connect.focusArea, `Imported from outreach queue on ${today}.`].filter(Boolean).join("\n\n"),
        lastContactDate: connect.dateSent || today,
        nextFollowUpDate: "",
        howWeMet: "LinkedIn outreach",
        nextAction: "Continue the conversation",
        followUpType: FollowUpType.Reply,
        interactions: [
          {
            id: 0,
            date: connect.dateSent || today,
            type: InteractionType.LinkedIn,
            summary: "Replied to LinkedIn outreach.",
          },
        ],
      };

      const saved = await api.createNetworkingContact(payload);
      setContacts((current) => [saved, ...current]);
    }

    setPotentialBusy(true);
    try {
      await api.updatePotentialConnect(connect.id, {
        status: "converted_to_network",
        dateSent: connect.dateSent,
      });
      const refreshed = await loadPotentialConnects();
      if (potentialDraft?.id === connect.id) {
        const refreshedConnect = refreshed.find((candidate) => candidate.id === connect.id) ?? null;
        setPotentialDraft(refreshedConnect);
      }
    } finally {
      setPotentialBusy(false);
    }
  }

  return (
    <section className="page networking-page">
      <motion.div className="page-heading" {...reveal}>
        <div>
          <h2 className="hero-title">Networking</h2>
        </div>
      </motion.div>

      <motion.section className="surface-card" {...reveal}>
        <div className="surface-header">
          <div>
            <h3>Outreach queue</h3>
          </div>
        </div>

        <div className="networking-outreach-stats">
          <div className="networking-outreach-stat">
            <strong>{potentialConnects.length}</strong>
            <span>Total</span>
          </div>
          <div className="networking-outreach-stat">
            <strong>{potentialStatusCounts.pending ?? 0}</strong>
            <span>Pending</span>
          </div>
          <div className="networking-outreach-stat">
            <strong>{potentialStatusCounts.sent ?? 0}</strong>
            <span>Sent</span>
          </div>
          <div className="networking-outreach-stat">
            <strong>{potentialStatusCounts.replied ?? 0}</strong>
            <span>Replied</span>
          </div>
          <div className="networking-outreach-stat">
            <strong>{potentialStatusCounts.converted_to_network ?? 0}</strong>
            <span>Converted</span>
          </div>
          <div className="networking-outreach-stat">
            <strong>{filteredPotentialConnects.length}</strong>
            <span>In view</span>
          </div>
        </div>

        <button
          className="networking-company-counts-toggle"
          onClick={() => setShowCompanyCounts((v) => !v)}
        >
          {showCompanyCounts ? "Hide" : "Show"} companies ({potentialCompanyCounts.length})
        </button>
        {showCompanyCounts && (
          <div className="networking-badge-row networking-company-counts">
            {potentialCompanyCounts.map(([company, count]) => (
              <span key={company} className="networking-badge neutral">
                {company} · {count}
              </span>
            ))}
          </div>
        )}

        <div className="networking-toolbar networking-outreach-toolbar">
          <div className="networking-toolbar-group">
            <label className="networking-filter networking-search-filter">
              <span>Search</span>
              <div className="networking-search-shell">
                <Search size={15} />
                <input
                  value={potentialSearch}
                  onChange={(event) => setPotentialSearch(event.target.value)}
                  placeholder="Name, role, company, focus..."
                />
              </div>
            </label>

            <label className="networking-filter">
              <span>Company</span>
              <select value={potentialCompanyFilter} onChange={(event) => setPotentialCompanyFilter(event.target.value)}>
                {potentialCompanies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </label>

            <label className="networking-filter">
              <span>Status</span>
              <select
                value={potentialStatusFilter}
                onChange={(event) => setPotentialStatusFilter(event.target.value as PotentialConnectStatus | "all")}
              >
                {POTENTIAL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="networking-outreach-grid">
          <div className="networking-outreach-list networking-outreach-list-hidden-scroll">
            {filteredPotentialConnects.length === 0 ? (
              <div className="empty-state networking-empty">
                <h4>No outreach candidates in this filter.</h4>
                <p>Try widening company, status, or date filters.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredPotentialConnects.map((connect) => (
                  <motion.button
                    key={connect.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.985, transition: { duration: 0.18, ease: EASE } }}
                    transition={{ duration: 0.22, ease: EASE }}
                    type="button"
                    className={`networking-outreach-card ${
                      selectedPotentialConnectId === connect.id ? "active" : ""
                    }`}
                    onClick={() => openPotentialConnect(connect)}
                  >
                    <div className="networking-outreach-card-header">
                      <div>
                        <strong>{connect.name}</strong>
                        <p>{connect.company}</p>
                      </div>
                      <span className={`networking-badge ${getPotentialStatusClassName(connect.status)}`}>
                        {connect.status}
                      </span>
                    </div>
                    <small>{connect.role}</small>
                    <p>{connect.connectionRequest}</p>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="networking-outreach-editor">
            <AnimatePresence mode="wait" initial={false}>
              {potentialDraft ? (
              <motion.div
                key={`${potentialDraft.id}-${potentialDraft.status}`}
                className="networking-outreach-editor-body"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE } }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <div className="surface-header">
                  <div>
                    <h3>{potentialDraft.name}</h3>
                    <div className="networking-outreach-company-row">
                      {showPotentialCompanyEditor ? (
                        <>
                          <input
                            className="networking-outreach-company-input"
                            name="company"
                            value={potentialDraft.company}
                            onChange={handlePotentialDraftChange}
                            placeholder="Company"
                          />
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Save company"
                            onClick={async () => {
                              await savePotentialConnect();
                              setShowPotentialCompanyEditor(false);
                            }}
                            disabled={potentialBusy || potentialDraft.company.trim().length === 0}
                          >
                            <Check size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <p>{potentialDraft.company}</p>
                          <button
                            type="button"
                            className="icon-button networking-outreach-edit-trigger"
                            aria-label="Edit company"
                            onClick={() => setShowPotentialCompanyEditor(true)}
                          >
                            <Pencil size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="networking-outreach-role-line">{potentialDraft.role}</p>
                  </div>
                  <div className="networking-outreach-status-tabs" aria-label="Status">
                    {(["pending", "sent", "replied", "converted_to_network"] as PotentialConnectStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`networking-outreach-status-tab ${getPotentialStatusClassName(status)} ${
                          potentialDraft.status === status ? "active" : ""
                        }`}
                        onClick={() => void updatePotentialStatus(status)}
                        disabled={potentialBusy}
                      >
                        {formatPotentialStatusLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="networking-outreach-field">
                  <span className="networking-outreach-field-header">
                    <span className="metric-label">Message</span>
                    <span className="networking-outreach-char-count">
                      {(potentialSelectionLength > 0
                        ? potentialSelectionLength
                        : potentialDraft.connectionRequest.length)}/300
                    </span>
                  </span>
                  <textarea
                    className="field-textarea networking-outreach-message"
                    name="connectionRequest"
                    value={potentialDraft.connectionRequest}
                    onChange={handlePotentialDraftChange}
                    onSelect={handlePotentialMessageSelection}
                    onKeyUp={handlePotentialMessageSelection}
                    onClick={handlePotentialMessageSelection}
                    rows={12}
                    spellCheck
                  />
                </label>

                <div className="editor-actions networking-outreach-actions-row">
                  <div className="networking-outreach-actions-left">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void copyPotentialMessage()}
                      disabled={potentialBusy}
                    >
                      <Copy size={16} />
                      {potentialCopyState === "copied" ? "Copied" : "Copy message"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => potentialDraft.linkedin && window.open(potentialDraft.linkedin, "_blank", "noopener,noreferrer")}
                      disabled={!potentialDraft.linkedin}
                    >
                      <ExternalLink size={16} />
                      Open LinkedIn
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void savePotentialConnect()}
                      disabled={potentialBusy}
                    >
                      Save draft
                    </button>
                    {potentialDraft.status === "replied" ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void savePotentialConnectToNetwork()}
                        disabled={potentialBusy}
                      >
                        <UserPlus size={16} />
                        {isPotentialConnectSaved(potentialDraft) ? "Move to network" : "Save to network"}
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSendPotentialConnect()}
                    disabled={potentialBusy}
                  >
                    <MessageSquare size={16} />
                    Send
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE } }}
                transition={{ duration: 0.2, ease: EASE }}
                className="empty-state networking-empty"
              >
                <h4>Select someone from the queue.</h4>
                <p>We&apos;ll show the full message here so you can edit and send it fast.</p>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {repliedPotentialConnects.length > 0 ? (
          <div className="task-subsection">
            <div className="surface-header task-subsection-header">
              <div>
                <h3>Replied pool</h3>
              </div>
            </div>

            <div className="networking-outreach-replied-list">
              <AnimatePresence initial={false}>
                {repliedPotentialConnects.map((connect) => (
                  <motion.div
                    key={connect.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.985, transition: { duration: 0.18, ease: EASE } }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="networking-outreach-replied-card"
                  >
                    <div>
                      <strong>{connect.name}</strong>
                      <p>{connect.company} · {connect.role}</p>
                    </div>
                    <div className="editor-actions networking-outreach-replied-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openPotentialConnect(connect)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void savePotentialConnectToNetwork(connect)}
                        disabled={potentialBusy}
                      >
                        <UserPlus size={16} />
                        {isPotentialConnectSaved(connect) ? "Move to network" : "Save to network"}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : null}
      </motion.section>

      <motion.section className="surface-card" {...reveal}>
        <div className="networking-toolbar">
          <div className="networking-toolbar-group">
            <label className="networking-filter">
              <span>Company</span>
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </label>

            <label className="networking-filter">
              <span>Location</span>
              <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="networking-filter">
              <span>Role</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="networking-filter">
              <span>Sort</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as NetworkingSortKey)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" className="primary-button networking-add-button" onClick={openNewContact}>
            <Plus size={16} />
            Add person
          </button>
        </div>

        {filteredContacts.length === 0 ? (
          <div className="empty-state networking-empty">
            <h4>No connections in this filter.</h4>
            <p>Try a different company filter to bring your network table back.</p>
          </div>
        ) : (
          <div className="networking-table-shell">
            <table className="networking-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Next action</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={editingContactId === contact.id ? "active" : ""}
                    onClick={() => openExistingContact(contact)}
                  >
                    <td>
                      <div className="networking-person-cell">
                        <strong>{contact.name}</strong>
                        <div className="networking-person-meta">
                          <span>{contact.company}</span>
                          {contact.role ? <><span className="networking-meta-sep">·</span><span>{contact.role}</span></> : null}
                        </div>
                        <div className="networking-badge-row">
                          {contact.tags.map((tag) => (
                            <span key={tag} className={`networking-badge tag-${slugify(tag)}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="networking-action-cell">
                        <strong>{contact.nextAction}</strong>
                        {contact.followUpType ? <small>{contact.followUpType}</small> : null}
                      </div>
                    </td>
                    <td>
                      <div className="networking-followup-cell">
                        {isValidDateValue(contact.nextFollowUpDate) ? (
                          <>
                            <span
                              className={`networking-badge ${
                                contact.isOverdue ? "overdue" : "upcoming"
                              }`}
                            >
                              {contact.isOverdue
                                ? `${Math.abs(getDaysUntil(contact.nextFollowUpDate))}d overdue`
                                : `${getDaysUntil(contact.nextFollowUpDate)}d left`}
                            </span>
                            <small>Follow up {formatShortDate(contact.nextFollowUpDate)}</small>
                            <small>{getDaysSince(contact.lastContactDate)}d since contact</small>
                          </>
                        ) : (
                          <>
                            <span className="networking-badge neutral">No follow-up planned</span>
                            <small>Not planning to follow up</small>
                            <small>{getDaysSince(contact.lastContactDate)}d since contact</small>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      <motion.section className="surface-card networking-overdue-card" {...reveal}>
        <div className="surface-header">
          <div>
            <h3>Overdue follow-ups</h3>
          </div>
        </div>

        {overdueContacts.length === 0 ? (
          null
        ) : (
          <div className="networking-overdue-list">
            {overdueContacts.map((contact) => (
              <button
                key={contact.id}
                className={`networking-overdue-item ${
                  editingContactId === contact.id ? "active" : ""
                }`}
                onClick={() => openExistingContact(contact)}
              >
                <div className="networking-overdue-summary">
                  <strong>{contact.name}</strong>
                  <p>{contact.company}</p>
                  <p>{contact.role}</p>
                </div>
                <div className="networking-overdue-meta">
                  <span className="networking-badge overdue">
                    {getDaysSince(contact.lastContactDate)}d since contact
                  </span>
                  <small>{contact.nextAction}</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.section>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {draftContact ? (
                <motion.div
                  className="networking-modal-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  onClick={closeEditor}
                >
                  <motion.div
                    className="surface-card networking-modal"
                    initial={{ opacity: 0, y: 28, scale: 0.965 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.975 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <form className="networking-editor" onSubmit={handleSaveContact}>
                      <div className="surface-header networking-modal-header">
                        <div>
                          <h3>{draftContact.name || "New person"}</h3>
                        </div>
                        <button
                          className="icon-button networking-modal-close"
                          type="button"
                          aria-label="Close contact details"
                          onClick={closeEditor}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Name</span>
                          <input name="name" value={draftContact.name} onChange={handleDraftChange} required />
                        </label>
                        <label>
                          <span className="metric-label">Company</span>
                          <select name="company" value={draftContact.company} onChange={handleDraftChange} required>
                            <option value="">Select company</option>
                            {options.companyOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Role</span>
                          <select name="role" value={draftContact.role} onChange={handleDraftChange}>
                            {options.roleOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="metric-label">Tags</span>
                          <div className="networking-tag-selector">
                            {options.tagOptions.map((tag) => {
                              const active = draftContact.tags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  className={`chip ${active ? "active" : ""}`}
                                  onClick={() =>
                                    setDraftContact((current) =>
                                      current
                                        ? {
                                            ...current,
                                            tags: active
                                              ? current.tags.filter((currentTag) => currentTag !== tag)
                                              : [...current.tags, tag],
                                          }
                                        : current,
                                    )
                                  }
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </label>
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Email</span>
                          <input name="email" type="email" value={draftContact.email} onChange={handleDraftChange} />
                        </label>
                        <label>
                          <span className="metric-label">Phone</span>
                          <input name="phone" value={draftContact.phone} onChange={handleDraftChange} />
                        </label>
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">LinkedIn</span>
                          <input name="linkedin" value={draftContact.linkedin} onChange={handleDraftChange} />
                        </label>
                        <div />
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Region / state</span>
                          <select
                            name="location.region"
                            value={draftContact.location.region}
                            onChange={handleDraftChange}
                          >
                            <option value="">Select region</option>
                            {regionOptions.map((region) => (
                              <option key={region} value={region}>
                                {region}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="metric-label">City</span>
                          <select
                            name="location.city"
                            value={draftContact.location.city}
                            onChange={handleDraftChange}
                            disabled={!draftContact.location.region}
                          >
                            <option value="">
                              {draftContact.location.region ? "Select city" : "Pick a region first"}
                            </option>
                            {cityOptions.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div />
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">How we met</span>
                          <input name="howWeMet" value={draftContact.howWeMet} onChange={handleDraftChange} />
                        </label>
                        <div />
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Last contact</span>
                          <input
                            name="lastContactDate"
                            type="date"
                            value={draftContact.lastContactDate}
                            onChange={handleDraftChange}
                          />
                        </label>
                        <label>
                          <div className="networking-followup-label-row">
                            <span className="metric-label">Next follow-up</span>
                            {draftContact.nextFollowUpDate ? (
                              <button type="button" className="networking-done-btn" onClick={handleMarkFollowUpDone}>
                                <Check size={11} /> Done
                              </button>
                            ) : null}
                          </div>
                          <input
                            name="nextFollowUpDate"
                            type="date"
                            value={draftContact.nextFollowUpDate}
                            onChange={handleDraftChange}
                          />
                        </label>
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Follow-up type</span>
                          <select name="followUpType" value={draftContact.followUpType} onChange={handleDraftChange}>
                            <option value="">Not set</option>
                            {options.followUpOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div />
                      </div>

                      <div className="field-row networking-editor-grid">
                        <label>
                          <span className="metric-label">Next action</span>
                          <input name="nextAction" value={draftContact.nextAction} onChange={handleDraftChange} />
                        </label>
                        <div />
                      </div>

                      <label>
                        <span className="metric-label">Notes</span>
                        <textarea
                          className="field-textarea"
                          name="notes"
                          value={draftContact.notes}
                          onChange={handleDraftChange}
                        />
                      </label>

                      <div className="networking-detail-section">
                        <div className="networking-section-header">
                          <h4>Interactions</h4>
                          {newInteractionDraft === null ? (
                            <button
                              type="button"
                              className="networking-add-btn"
                              onClick={() =>
                                setNewInteractionDraft({
                                  date: getTodayString(),
                                  type: options.interactionTypeOptions[0] ?? InteractionType.Message,
                                  summary: "",
                                })
                              }
                            >
                              <Plus size={13} /> Add
                            </button>
                          ) : null}
                        </div>
                        {newInteractionDraft !== null ? (
                          <div className="networking-add-interaction-form">
                            <div className="networking-add-interaction-fields">
                              <input
                                type="date"
                                value={newInteractionDraft.date}
                                onChange={(e) => setNewInteractionDraft({ ...newInteractionDraft, date: e.target.value })}
                              />
                              <select
                                value={newInteractionDraft.type}
                                onChange={(e) => setNewInteractionDraft({ ...newInteractionDraft, type: e.target.value })}
                              >
                                {options.interactionTypeOptions.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                            <input
                              placeholder="Brief summary…"
                              value={newInteractionDraft.summary}
                              onChange={(e) => setNewInteractionDraft({ ...newInteractionDraft, summary: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddInteraction(); } }}
                            />
                            <div className="networking-add-interaction-actions">
                              <button type="button" className="secondary-button" onClick={() => setNewInteractionDraft(null)}>Cancel</button>
                              <button type="button" className="primary-button" onClick={handleAddInteraction} disabled={!newInteractionDraft.summary.trim()}>Log</button>
                            </div>
                          </div>
                        ) : null}
                        <div className="networking-interactions">
                          {draftContact.interactions.length === 0 ? (
                            <div className="networking-note-card">
                              <p>No interactions logged yet.</p>
                            </div>
                          ) : (
                            draftContact.interactions.map((interaction) => (
                              <div key={interaction.id} className="networking-interaction-row">
                                <div className="networking-interaction-dot" />
                                <div>
                                  <strong>{formatLongDate(interaction.date)}</strong>
                                  <p>
                                    {interaction.type} · {interaction.summary}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="editor-actions networking-editor-actions">
                        <button type="button" className="secondary-button" onClick={closeEditor}>
                          Cancel
                        </button>
                        <button type="submit" className="primary-button">
                          Save person
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}

function createEmptyContact(): NetworkingContact {
  const today = getTodayString();
  return {
    id: 0,
    name: "",
    company: "",
    role: NetworkingRole.SoftwareEngineer,
    tags: [],
    email: "",
    phone: "",
    linkedin: "",
    location: {
      city: "",
      region: "",
    },
    notes: "",
    lastContactDate: today,
    nextFollowUpDate: "",
    howWeMet: "",
    nextAction: "",
    followUpType: "",
    isOverdue: false,
    interactions: [],
    createdAt: today,
    updatedAt: today,
  };
}

function normalizeContact(contact: NetworkingContact): NetworkingContact {
  const today = new Date();
  return {
    ...contact,
    location: {
      city: contact.location.city.trim(),
      region: contact.location.region.trim(),
    },
    phone: contact.phone.trim(),
    isOverdue:
      contact.nextFollowUpDate.length > 0 &&
      new Date(`${contact.nextFollowUpDate}T12:00:00`) < today,
    updatedAt: getTodayString(),
  };
}

function stripContactMeta(contact: NetworkingContact) {
  return {
    name: contact.name,
    company: contact.company,
    role: contact.role,
    tags: contact.tags,
    email: contact.email,
    phone: contact.phone,
    linkedin: contact.linkedin,
    location: contact.location,
    notes: contact.notes,
    lastContactDate: contact.lastContactDate,
    nextFollowUpDate: contact.nextFollowUpDate,
    howWeMet: contact.howWeMet,
    nextAction: contact.nextAction,
    followUpType: contact.followUpType,
    interactions: contact.interactions,
  };
}

function formatShortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

function isValidDateValue(value: string) {
  return value.length > 0 && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function getPotentialStatusClassName(status: PotentialConnectStatus) {
  if (status === "sent") {
    return "upcoming";
  }
  if (status === "replied") {
    return "strength-strong";
  }
  if (status === "converted_to_network") {
    return "neutral";
  }
  return "overdue";
}

function formatPotentialStatusLabel(status: PotentialConnectStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
