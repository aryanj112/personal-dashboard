import { motion } from "framer-motion";
import {
  Building2,
  Check,
  ChevronDown,
  Copy,
  Dumbbell,
  FileBadge2,
  GripVertical,
  Guitar,
  LayoutGrid,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { WorkoutHistoryCard } from "../components/WorkoutHistoryCard";
import { api } from "../lib/api";
import { formatDurationMinutes } from "../lib/duration";
import type { NetworkingOptionConfig } from "../lib/networking";
import type { Company, ModuleResponse } from "../lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

const TIME_ZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
] as const;

export function SettingsPage({
  timeZone,
  guitar,
  workouts,
  dashboardPreferences,
  networkingOptions,
  onTimeZoneChange,
  onDashboardPreferencesChange,
  onNetworkingOptionsChange,
  onRefresh,
}: {
  timeZone: string;
  guitar: ModuleResponse | null;
  workouts: ModuleResponse | null;
  dashboardPreferences: {
    show_dashboard_refresh: boolean;
    show_open_today: boolean;
    show_export_today: boolean;
    show_notes: boolean;
    show_resume: boolean;
  };
  networkingOptions: NetworkingOptionConfig;
  onTimeZoneChange: (timeZone: string) => void;
  onDashboardPreferencesChange: (preferences: {
    show_dashboard_refresh: boolean;
    show_open_today: boolean;
    show_export_today: boolean;
    show_notes: boolean;
    show_resume: boolean;
  }) => void;
  onNetworkingOptionsChange: (options: NetworkingOptionConfig) => void;
  onRefresh: () => Promise<void>;
}) {
  const [showGuitarSection, setShowGuitarSection] = useState(false);
  const [showWorkoutSection, setShowWorkoutSection] = useState(false);
  const [showNetworkingEnums, setShowNetworkingEnums] = useState(false);
  const [showOptionals, setShowOptionals] = useState(false);
  const [showGuitarManager, setShowGuitarManager] = useState(false);
  const [showGuitarHistory, setShowGuitarHistory] = useState(false);
  const [showWorkoutManager, setShowWorkoutManager] = useState(false);
  const [showWorkoutHistory, setShowWorkoutHistory] = useState(false);
  const [showCompanyList, setShowCompanyList] = useState(false);
  const [showHabits, setShowHabits] = useState(false);

  function updatePreference<K extends keyof typeof dashboardPreferences>(key: K, value: boolean) {
    onDashboardPreferencesChange({
      ...dashboardPreferences,
      [key]: value,
    });
  }

  function updateNetworkingOptions<K extends keyof NetworkingOptionConfig>(
    key: K,
    nextValues: string[],
  ) {
    onNetworkingOptionsChange({
      ...networkingOptions,
      [key]: nextValues,
    });
  }

  return (
    <section className="page settings-page">
      <motion.div className="page-heading" {...reveal}>
        <div>
          <h2 className="hero-title hover-underline-title">Shape the workspace.</h2>
        </div>
      </motion.div>

      <motion.section className="surface-card settings-appearance-row" {...reveal}>
        <span className="metric-label">Time zone</span>
        <select
          className="chip-edit"
          value={timeZone}
          onChange={(event) => onTimeZoneChange(event.target.value)}
          aria-label="Time zone"
        >
          {getTimeZoneOptions(timeZone).map((option) => (
            <option key={option} value={option}>
              {formatTimeZoneLabel(option)}
            </option>
          ))}
        </select>
      </motion.section>

      <div className="content-grid settings-grid">

      </div>

      <div className="content-grid settings-grid">
        <SettingsModulePanel
          title="Guitar"
          managerTitle="Manage practice parts"
          historyTitle="History"
          kind="guitar"
          data={guitar}
          showSection={showGuitarSection}
          showManager={showGuitarManager}
          showHistory={showGuitarHistory}
          onToggleSection={() => setShowGuitarSection((current) => !current)}
          onToggleManager={() => setShowGuitarManager((current) => !current)}
          onToggleHistory={() => setShowGuitarHistory((current) => !current)}
          onRefresh={onRefresh}
          icon={<Guitar size={18} />}
        />

        <SettingsModulePanel
          title="Workouts"
          managerTitle="Manage workout types"
          historyTitle="History"
          kind="workouts"
          data={workouts}
          showSection={showWorkoutSection}
          showManager={showWorkoutManager}
          showHistory={showWorkoutHistory}
          onToggleSection={() => setShowWorkoutSection((current) => !current)}
          onToggleManager={() => setShowWorkoutManager((current) => !current)}
          onToggleHistory={() => setShowWorkoutHistory((current) => !current)}
          onRefresh={onRefresh}
          icon={<Dumbbell size={18} />}
        />
      </div>

      <motion.section className="surface-card" {...reveal}>
        <button className="surface-toggle" onClick={() => setShowNetworkingEnums((current) => !current)}>
          <div>
            <h3>Networking enums</h3>
          </div>
          <ChevronDown className={showNetworkingEnums ? "open" : ""} size={18} />
        </button>

        {showNetworkingEnums ? (
          <div className="toggle-panel">
            <div className="settings-enum-grid">
              <EnumManager
                title="Roles"
                values={networkingOptions.roleOptions}
                onChange={(nextValues) => updateNetworkingOptions("roleOptions", nextValues)}
              />
              <EnumManager
                title="Tags"
                values={networkingOptions.tagOptions}
                onChange={(nextValues) => updateNetworkingOptions("tagOptions", nextValues)}
              />
              <EnumManager
                title="Follow-up types"
                values={networkingOptions.followUpOptions}
                onChange={(nextValues) => updateNetworkingOptions("followUpOptions", nextValues)}
              />
              <EnumManager
                title="Interaction types"
                values={networkingOptions.interactionTypeOptions}
                onChange={(nextValues) => updateNetworkingOptions("interactionTypeOptions", nextValues)}
              />
              <LocationOptionsManager
                locationOptions={networkingOptions.locationOptions}
                onChange={(nextLocationOptions) =>
                  onNetworkingOptionsChange({
                    ...networkingOptions,
                    locationOptions: nextLocationOptions,
                  })
                }
              />
            </div>
          </div>
        ) : null}
      </motion.section>

      <motion.section className="surface-card" {...reveal}>
        <button className="surface-toggle" onClick={() => setShowCompanyList((current) => !current)}>
          <div>
            <h3>Company list</h3>
          </div>
          <ChevronDown className={showCompanyList ? "open" : ""} size={18} />
        </button>
        {showCompanyList ? (
          <div className="toggle-panel">
            <CompanyListManager />
          </div>
        ) : null}
      </motion.section>

      <motion.section className="surface-card" {...reveal}>
        <button className="surface-toggle" onClick={() => setShowHabits((current) => !current)}>
          <div>
            <h3>Habits</h3>
          </div>
          <ChevronDown className={showHabits ? "open" : ""} size={18} />
        </button>
        {showHabits ? (
          <div className="toggle-panel">
            <HabitsManager />
          </div>
        ) : null}
      </motion.section>

      <motion.section className="surface-card" {...reveal}>
        <button className="surface-toggle" onClick={() => setShowOptionals((current) => !current)}>
          <div>
            <h3>Optionals</h3>
          </div>
          <ChevronDown className={showOptionals ? "open" : ""} size={18} />
        </button>
        {showOptionals ? (
          <div className="toggle-panel">
            <div className="settings-toggle-list">
              <label className="settings-toggle-row">
                <span className="settings-toggle-copy">
                  <span className="settings-tile-icon">
                    <LayoutGrid size={18} />
                  </span>
                  <span>
                    <strong>Show dashboard refresh</strong>
                    <small>Displays the refresh button in the overview hero.</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={dashboardPreferences.show_dashboard_refresh}
                  onChange={(event) => updatePreference("show_dashboard_refresh", event.target.checked)}
                />
              </label>

              <label className="settings-toggle-row">
                <span className="settings-toggle-copy">
                  <span className="settings-tile-icon">
                    <LayoutGrid size={18} />
                  </span>
                  <span>
                    <strong>Show export today</strong>
                    <small>Displays a shareable day summary button in the overview header.</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={dashboardPreferences.show_export_today}
                  onChange={(event) => updatePreference("show_export_today", event.target.checked)}
                />
              </label>

              <label className="settings-toggle-row">
                <span className="settings-toggle-copy">
                  <span className="settings-tile-icon">
                    <StickyNote size={18} />
                  </span>
                  <span>
                    <strong>Show notes panel</strong>
                    <small>Displays the quick notes scratchpad on the Today page.</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={dashboardPreferences.show_notes}
                  onChange={(event) => updatePreference("show_notes", event.target.checked)}
                />
              </label>

              <label className="settings-toggle-row">
                <span className="settings-toggle-copy">
                  <span className="settings-tile-icon">
                    <FileBadge2 size={18} />
                  </span>
                  <span>
                    <strong>Show resume</strong>
                    <small>Adds the Resume page to the navigation bar.</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={dashboardPreferences.show_resume}
                  onChange={(event) => updatePreference("show_resume", event.target.checked)}
                />
              </label>

            </div>
          </div>
        ) : null}
      </motion.section>
    </section>
  );
}

function getTimeZoneOptions(selectedTimeZone: string) {
  return selectedTimeZone && !TIME_ZONE_OPTIONS.includes(selectedTimeZone as (typeof TIME_ZONE_OPTIONS)[number])
    ? [selectedTimeZone, ...TIME_ZONE_OPTIONS]
    : [...TIME_ZONE_OPTIONS];
}

function formatTimeZoneLabel(value: string) {
  if (value === "America/New_York") {
    return "Eastern (America/New_York)";
  }
  if (value === "America/Chicago") {
    return "Central (America/Chicago)";
  }
  if (value === "America/Denver") {
    return "Mountain (America/Denver)";
  }
  if (value === "America/Los_Angeles") {
    return "Pacific (America/Los_Angeles)";
  }
  return value;
}


function LocationOptionsManager({
  locationOptions,
  onChange,
}: {
  locationOptions: Record<string, string[]>;
  onChange: (locationOptions: Record<string, string[]>) => void;
}) {
  const [newRegion, setNewRegion] = useState("");
  const [activeRegion, setActiveRegion] = useState(Object.keys(locationOptions)[0] ?? "");
  const [newCity, setNewCity] = useState("");

  function addRegion(event: FormEvent) {
    event.preventDefault();
    const trimmed = newRegion.trim();
    if (!trimmed || locationOptions[trimmed]) {
      return;
    }
    const nextLocationOptions = {
      ...locationOptions,
      [trimmed]: [],
    };
    onChange(nextLocationOptions);
    setActiveRegion(trimmed);
    setNewRegion("");
  }

  function removeRegion(regionToRemove: string) {
    const nextEntries = Object.entries(locationOptions).filter(([region]) => region !== regionToRemove);
    const nextLocationOptions = Object.fromEntries(nextEntries);
    onChange(nextLocationOptions);
    if (activeRegion === regionToRemove) {
      setActiveRegion(nextEntries[0]?.[0] ?? "");
    }
  }

  function renameRegion(previousRegion: string, nextRegion: string) {
    const trimmed = nextRegion.trim();
    if (!trimmed || (trimmed !== previousRegion && locationOptions[trimmed])) {
      return;
    }

    const nextLocationOptions = Object.fromEntries(
      Object.entries(locationOptions).map(([region, cities]) =>
        region === previousRegion ? [trimmed, cities] : [region, cities],
      ),
    );
    onChange(nextLocationOptions);
    if (activeRegion === previousRegion) {
      setActiveRegion(trimmed);
    }
  }

  function addCity(event: FormEvent) {
    event.preventDefault();
    const trimmed = newCity.trim();
    if (!activeRegion || !trimmed || locationOptions[activeRegion]?.includes(trimmed)) {
      return;
    }
    onChange({
      ...locationOptions,
      [activeRegion]: [...(locationOptions[activeRegion] ?? []), trimmed],
    });
    setNewCity("");
  }

  function updateCity(previousCity: string, nextCity: string) {
    const trimmed = nextCity.trim();
    if (!activeRegion) {
      return;
    }
    if (!trimmed) {
      removeCity(previousCity);
      return;
    }
    onChange({
      ...locationOptions,
      [activeRegion]: locationOptions[activeRegion].map((city) =>
        city === previousCity ? trimmed : city,
      ),
    });
  }

  function removeCity(cityToRemove: string) {
    if (!activeRegion) {
      return;
    }
    onChange({
      ...locationOptions,
      [activeRegion]: locationOptions[activeRegion].filter((city) => city !== cityToRemove),
    });
  }

  return (
    <div className="settings-enum-panel settings-location-panel">
      <div className="settings-enum-header">
        <h3>Locations</h3>
      </div>

      <form className="task-entry" onSubmit={addRegion}>
        <input value={newRegion} onChange={(event) => setNewRegion(event.target.value)} placeholder="Add region..." />
        <button type="submit">
          <Plus size={16} />
          Add region
        </button>
      </form>

      <div className="settings-location-layout">
        <div className="settings-location-column">
          <strong className="metric-label">Regions</strong>
          <div className="chip-grid">
            {Object.keys(locationOptions).map((region) => (
              <div key={region} onClick={() => setActiveRegion(region)}>
                <EditableOption value={region} onSave={renameRegion} onRemove={removeRegion} />
              </div>
            ))}
          </div>
        </div>

        <div className="settings-location-column">
          <strong className="metric-label">Cities</strong>
          {activeRegion ? (
            <>
              <form className="task-entry" onSubmit={addCity}>
                <input value={newCity} onChange={(event) => setNewCity(event.target.value)} placeholder={`Add city in ${activeRegion}...`} />
                <button type="submit">
                  <Plus size={16} />
                  Add city
                </button>
              </form>
              <div className="chip-grid">
                {(locationOptions[activeRegion] ?? []).map((city) => (
                  <EditableOption key={city} value={city} onSave={(_, nextValue) => updateCity(city, nextValue)} onRemove={removeCity} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h4>No region selected.</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EnumManager({
  title,
  values,
  onChange,
}: {
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [newValue, setNewValue] = useState("");

  function addValue(event: FormEvent) {
    event.preventDefault();
    const trimmed = newValue.trim();
    if (!trimmed || values.includes(trimmed)) {
      return;
    }
    onChange([...values, trimmed]);
    setNewValue("");
  }

  function updateValue(previousValue: string, nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      onChange(values.filter((value) => value !== previousValue));
      return;
    }
    onChange(values.map((value) => (value === previousValue ? trimmed : value)));
  }

  function removeValue(targetValue: string) {
    onChange(values.filter((value) => value !== targetValue));
  }

  return (
    <div className="settings-enum-panel">
      <div className="settings-enum-header">
        <h3>{title}</h3>
      </div>

      <form className="task-entry" onSubmit={addValue}>
        <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder={`Add ${title.toLowerCase()}...`} />
        <button type="submit">
          <Plus size={16} />
          Add
        </button>
      </form>

      <div className="chip-grid">
        {values.map((value) => (
          <EditableOption key={value} value={value} onSave={updateValue} onRemove={removeValue} />
        ))}
      </div>
    </div>
  );
}

function EditableOption({
  value,
  onSave,
  onRemove,
}: {
  value: string;
  onSave: (previousValue: string, nextValue: string) => void;
  onRemove: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function save() {
    onSave(value, draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        className="chip-edit"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            save();
          }
        }}
        autoFocus
      />
    );
  }

  return (
    <div className="chip-chip-row">
      <button type="button" className="chip" onClick={() => setEditing(true)}>
        {value}
      </button>
      <button
        className="icon-button danger section-delete"
        type="button"
        onClick={() => onRemove(value)}
        aria-label={`Delete ${value}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}


function SettingsModulePanel({
  title,
  managerTitle,
  historyTitle,
  kind,
  data,
  showSection,
  showManager,
  showHistory,
  onToggleSection,
  onToggleManager,
  onToggleHistory,
  onRefresh,
  icon,
}: {
  title: string;
  managerTitle: string;
  historyTitle: string;
  kind: "guitar" | "workouts";
  data: ModuleResponse | null;
  showSection: boolean;
  showManager: boolean;
  showHistory: boolean;
  onToggleSection: () => void;
  onToggleManager: () => void;
  onToggleHistory: () => void;
  onRefresh: () => Promise<void>;
  icon: ReactNode;
}) {
  const [newSection, setNewSection] = useState("");

  async function submitSection(event: FormEvent) {
    event.preventDefault();
    if (!newSection.trim()) return;
    await api.createSection(kind, newSection.trim());
    setNewSection("");
    await onRefresh();
  }

  return (
    <motion.section className="surface-card" {...reveal}>
      <button className="surface-toggle" onClick={onToggleSection}>
        <div className="settings-module-heading">
          <span className="settings-tile-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
        <ChevronDown className={showSection ? "open" : ""} size={18} />
      </button>

      {showSection ? (
        <div className="settings-module-stack toggle-panel">
        <button className="surface-toggle" onClick={onToggleManager}>
          <div>
            <h3>{managerTitle}</h3>
          </div>
          <ChevronDown className={showManager ? "open" : ""} size={18} />
        </button>

        {showManager ? (
          <div className="toggle-panel">
            <form className="task-entry" onSubmit={submitSection}>
              <input
                value={newSection}
                onChange={(event) => setNewSection(event.target.value)}
                placeholder={`Add a ${kind === "guitar" ? "part" : "type"}...`}
              />
              <button type="submit">
                <Plus size={16} />
                Add
              </button>
            </form>

            <div className="chip-grid">
              {(data?.sections ?? []).map((section) => (
                <EditableSection
                  key={section.id}
                  sectionId={section.id}
                  kind={kind}
                  name={section.name}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          </div>
        ) : null}

        <button className="surface-toggle" onClick={onToggleHistory}>
          <div>
            <h3>{historyTitle}</h3>
          </div>
          <ChevronDown className={showHistory ? "open" : ""} size={18} />
        </button>

        {showHistory ? (
          <div className="session-list">
            {(data?.sessions ?? []).map((session) => (
              kind === "workouts" ? (
                <WorkoutHistoryCard
                  key={session.id}
                  session={session}
                  sections={data?.sections ?? []}
                  onRefresh={onRefresh}
                />
              ) : (
                <div key={session.id} className="session-card">
                  <div>
                    <strong>{formatSessionDate(session.session_date)}</strong>
                    <p>
                      {session.sections.map((section) => section.name).join(", ") || "No type"}
                      {session.run_miles != null
                        ? ` · ${session.run_miles} mi in ${formatDurationMinutes(session.duration_minutes)}`
                        : ""}
                    </p>
                    {session.notes ? <small>{session.notes}</small> : null}
                  </div>
                  <button
                    className="icon-button danger"
                    onClick={async () => {
                      await api.deleteSession(kind, session.id);
                      await onRefresh();
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            ))}
            {(data?.sessions ?? []).length === 0 ? (
              <div className="empty-state">
                <h4>No sessions yet.</h4>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      ) : null}
    </motion.section>
  );
}

function formatSessionDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function EditableSection({
  sectionId,
  kind,
  name,
  onRefresh,
}: {
  sectionId: number;
  kind: "guitar" | "workouts";
  name: string;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(name);

  async function save() {
    if (!value.trim()) {
      setValue(name);
      setEditing(false);
      return;
    }
    await api.updateSection(kind, sectionId, value.trim());
    setEditing(false);
    await onRefresh();
  }

  async function remove() {
    await api.deleteSection(kind, sectionId);
    await onRefresh();
  }

  if (editing) {
    return (
      <input
        className="chip-edit"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void save();
          }
        }}
        autoFocus
      />
    );
  }

  if (confirming) {
    return (
      <div className="chip-chip-row chip-confirm-row">
        <span className="chip-confirm-label">Delete "{name}"?</span>
        <button className="icon-button danger" type="button" onClick={() => void remove()}>
          <Trash2 size={14} />
        </button>
        <button className="icon-button" type="button" onClick={() => setConfirming(false)}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="chip-chip-row">
      <button className="chip" onClick={() => setEditing(true)}>
        {name}
      </button>
      <button
        className="icon-button danger section-delete"
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

type HabitRow = { id: number; name: string; is_active: boolean; sort_order: number };

function HabitsManager() {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmingHabitId, setConfirmingHabitId] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  useEffect(() => { loadHabits(); }, []);

  function loadHabits() {
    void api.getHabits().then((data) => { setHabits(data); setLoading(false); });
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = newHabitName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await api.createHabit(trimmed);
      setNewHabitName("");
      loadHabits();
    } catch {
      // silently fail — habit list will not refresh
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteHabit(id);
    setConfirmingHabitId(null);
    loadHabits();
  }

  function onDragStart(_e: DragEvent, index: number) {
    dragIndexRef.current = index;
  }

  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndexRef.current = index;
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = dragOverIndexRef.current;
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
    if (from === null || to === null || from === to) return;
    const next = [...habits];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const updated = next.map((h, i) => ({ ...h, sort_order: i + 1 }));
    setHabits(updated);
    try {
      await Promise.all(updated.map((h) => api.updateHabit(h.id, { sort_order: h.sort_order })));
    } catch {
      loadHabits();
    }
  }

  if (loading) return <p className="metric-label">Loading…</p>;

  return (
    <div className="habits-manager">
      <div className="habit-manager-list">
        {habits.map((habit, index) => (
          <div
            key={habit.id}
            className="habit-manager-row"
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={(e) => void onDrop(e)}
          >
            <GripVertical size={14} className="habit-grip" />
            <span className="habit-manager-name">{habit.name}</span>
            {confirmingHabitId === habit.id ? (
              <>
                <span className="chip-confirm-label">Delete?</span>
                <button className="icon-button danger" type="button" onClick={() => void handleDelete(habit.id)}>
                  <Trash2 size={14} />
                </button>
                <button className="icon-button" type="button" onClick={() => setConfirmingHabitId(null)}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                className="icon-button danger"
                type="button"
                onClick={() => setConfirmingHabitId(habit.id)}
                aria-label={`Delete ${habit.name}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {habits.length === 0 && <p className="metric-label">No habits yet.</p>}
      </div>

      <form className="habit-manager-add-row" onSubmit={(e) => void handleAdd(e)}>
        <input
          className="field-input"
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          placeholder="New habit name…"
        />
        <button className="secondary-button" type="submit" disabled={adding || !newHabitName.trim()}>
          <Plus size={14} />
          Add
        </button>
      </form>

    </div>
  );
}

function CompanyListManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  function loadCompanies() {
    void api.getCompanies().then(({ companies: data }) => {
      setCompanies(data);
      setLoading(false);
    });
  }

  const byCategory = companies.reduce<Record<string, Company[]>>((acc, c) => {
    const cat = c.category || "Uncategorized";
    (acc[cat] ??= []).push(c);
    return acc;
  }, {});

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addCategory.trim()) return;
    setAdding(true);
    try {
      await api.createCompany({
        name: addName.trim(),
        category: addCategory.trim(),
        careersUrl: addUrl.trim(),
      });
      setAddName("");
      setAddUrl("");
      loadCompanies();
    } finally {
      setAdding(false);
    }
  }

  const [confirmingCompanyId, setConfirmingCompanyId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    await api.deleteCompany(id);
    setConfirmingCompanyId(null);
    loadCompanies();
  }

  async function handleCopyCoworkText() {
    const { content } = await api.getCompaniesCoworkText();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className="metric-label">Loading…</p>;

  const categoryOrder = Object.keys(byCategory).sort((a, b) => a.localeCompare(b));

  return (
    <div className="company-list-manager">
      <div className="company-list-header">
        <span className="metric-label">
          {companies.length} companies · {categoryOrder.length} categories
        </span>
        <button
          className={`chip company-copy-btn${copied ? " copied" : ""}`}
          onClick={() => void handleCopyCoworkText()}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy cowork text"}
        </button>
      </div>

      {categoryOrder.map((cat) => (
        <div key={cat} className="company-category-group">
          <h4 className="company-category-title">
            <Building2 size={13} />
            {cat}
          </h4>
          <div className="chip-list">
            {(byCategory[cat] ?? [])
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((company) => (
                <div key={company.id} className="chip-chip-row">
                  {company.careersUrl ? (
                    <a
                      href={company.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chip company-chip"
                    >
                      {company.name}
                    </a>
                  ) : (
                    <span className="chip company-chip">{company.name}</span>
                  )}
                  {confirmingCompanyId === company.id ? (
                    <>
                      <span className="chip-confirm-label">Remove?</span>
                      <button className="icon-button danger" type="button" onClick={() => void handleDelete(company.id)}>
                        <Trash2 size={14} />
                      </button>
                      <button className="icon-button" type="button" onClick={() => setConfirmingCompanyId(null)}>
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="icon-button danger section-delete"
                      type="button"
                      onClick={() => setConfirmingCompanyId(company.id)}
                      aria-label={`Remove ${company.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      <form className="company-add-form" onSubmit={(e) => void handleAdd(e)}>
        <input
          className="chip-edit"
          placeholder="Company name"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
        />
        <input
          className="chip-edit"
          placeholder="Category (e.g. Robotics / Physical AI)"
          value={addCategory}
          onChange={(e) => setAddCategory(e.target.value)}
        />
        <input
          className="chip-edit"
          placeholder="Careers URL (optional)"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
        />
        <button
          type="submit"
          className="chip"
          disabled={adding || !addName.trim() || !addCategory.trim()}
        >
          <Plus size={13} />
          Add company
        </button>
      </form>
    </div>
  );
}
