import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Minus, Plus, Trash2 } from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { WeeklyPieChart } from "../components/Charts";
import { API_BASE, api } from "../lib/api";
import { getCurrentWeekBounds, getCurrentWeekRangeLabel } from "../lib/dates";
import type { GuitarResponse } from "../lib/types";

// ── Chord diagram ────────────────────────────────────────────────
type ChordValue = "x" | "o" | 1 | 2 | 3 | 4;
type CagedShape = "C" | "A" | "G" | "E" | "D";
type CagedPosition = { shape: CagedShape; startFret: number; chord: ChordValue[] };

const KEY_LABELS = ["C","C#/D♭","D","D#/E♭","E","F","F#/G♭","G","G#/A♭","A","A#/B♭","B"];

// Root fret per string for each key (index = semitone from C)
const ROOT_ON_E = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7]; // low E string
const ROOT_ON_A = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]; // A string
const ROOT_ON_D = [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // D string

// Open chord templates (used for natural positions)
const OPEN_C: ChordValue[] = ["x", 3, 2, "o", 1, "o"];
const OPEN_A: ChordValue[] = ["x", "o", 2, 2, 2, "o"];
const OPEN_G: ChordValue[] = [3, 2, "o", "o", "o", 3];
const OPEN_E: ChordValue[] = ["o", 2, 2, 1, "o", "o"];
const OPEN_D: ChordValue[] = ["x", "x", "o", 2, 3, 2];

// Barre shape templates (relative frets from startFret)
const TMPL_E: ChordValue[] = [1, 3, 3, 2, 1, 1];
const TMPL_A: ChordValue[] = ["x", 1, 3, 3, 3, 1];
const TMPL_G: ChordValue[] = [4, 3, 1, 1, 1, 4];
const TMPL_C: ChordValue[] = ["x", 4, 3, 1, 2, 1];
const TMPL_D: ChordValue[] = ["x", "x", 1, 3, 4, 3];

function getCAGEDPositions(keyIdx: number): CagedPosition[] {
  const rE = ROOT_ON_E[keyIdx];
  const rA = ROOT_ON_A[keyIdx];
  const rD = ROOT_ON_D[keyIdx];

  const ePos: CagedPosition = rE === 0
    ? { shape: "E", startFret: 1, chord: OPEN_E }
    : { shape: "E", startFret: rE, chord: TMPL_E };

  const aPos: CagedPosition = rA === 0
    ? { shape: "A", startFret: 1, chord: OPEN_A }
    : { shape: "A", startFret: rA, chord: TMPL_A };

  const dPos: CagedPosition = rD === 0
    ? { shape: "D", startFret: 1, chord: OPEN_D }
    : { shape: "D", startFret: rD, chord: TMPL_D };

  const gSF = (rE - 3 + 12) % 12;
  const gPos: CagedPosition = rE === 3
    ? { shape: "G", startFret: 1, chord: OPEN_G }
    : { shape: "G", startFret: gSF === 0 ? 12 : gSF, chord: TMPL_G };

  const cSF = (rA - 3 + 12) % 12;
  const cPos: CagedPosition = rA === 3
    ? { shape: "C", startFret: 1, chord: OPEN_C }
    : { shape: "C", startFret: cSF === 0 ? 12 : cSF, chord: TMPL_C };

  return [ePos, aPos, dPos, gPos, cPos].sort((a, b) => a.startFret - b.startFret);
}

// SVG metrics
const CD_W = 210;
const CD_H = 238;
const CD_START_X = 30;
const CD_S_SPACE = 28;
const CD_NUT_Y = 58;
const CD_FRET_H = 40;
const CD_NUM_FRETS = 4;
const CD_DOT_R = 9;
const CD_IND_Y = 28;
function cdStringX(s: number) { return CD_START_X + s * CD_S_SPACE; }
function cdFretLineY(f: number) { return CD_NUT_Y + f * CD_FRET_H; }
function cdDotY(f: number) { return CD_NUT_Y + (f - 0.5) * CD_FRET_H; }

const EASE = [0.22, 1, 0.36, 1] as const;
const panelReveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

export function GuitarPage({
  data,
  onRefresh,
}: {
  data: GuitarResponse;
  onRefresh: () => Promise<void>;
}) {
  const todayString = getTodayString();
  const [form, setForm] = useState({
    date: todayString,
    notes: "",
    section_ids: [] as number[],
  });
  const [showWeekSessions, setShowWeekSessions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [openMaterials, setOpenMaterials] = useState<Record<number, boolean>>({});
  const deltaBluesGroup =
    data.song_groups.find((group) => group.name.trim().toLowerCase() === "delta blues") ?? null;
  const weekRangeLabel = getCurrentWeekRangeLabel();
  const weekBounds = getCurrentWeekBounds();
  const thisWeekSessions = data.sessions.filter(
    (session) =>
      session.session_date >= weekBounds.startIso && session.session_date <= weekBounds.endIso,
  );

  async function submitSession(event: FormEvent) {
    event.preventDefault();
    await api.createSession("guitar", {
      date: form.date,
      duration_minutes: 0,
      notes: form.notes,
      section_ids: form.section_ids,
    });
    setForm({
      date: todayString,
      notes: "",
      section_ids: [],
    });
    await onRefresh();
  }

  return (
    <section className="page module-page guitar-workspace-page">
      <motion.div className="page-heading" {...panelReveal}>
        <div>
          <h2 className="hero-title">Guitar</h2>
        </div>
      </motion.div>

      <div className="content-grid module-top-grid">
        <motion.section className="surface-card" {...panelReveal}>
          <div className="surface-header">
            <div>
              <h3>Log session</h3>
            </div>
          </div>

          <form className="module-form" onSubmit={submitSession}>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </label>

            <label>
              <span>Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="What part did you work on?"
              />
            </label>

            <div className="field-group">
              <span className="field-caption">Parts worked on</span>
              <div className="chip-grid">
                {data.sections.map((section) => {
                  const active = form.section_ids.includes(section.id);
                  return (
                    <button
                      type="button"
                      key={section.id}
                      className={`chip ${active ? "active" : ""}`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          section_ids: active
                            ? current.section_ids.filter((id) => id !== section.id)
                            : [...current.section_ids, section.id],
                        }))
                      }
                    >
                      {section.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="primary-button">
              <Plus size={16} />
              Save session
            </button>
          </form>
        </motion.section>

        <motion.section className="surface-card" {...panelReveal}>
          <div className="surface-header">
            <div>
              <p className="eyebrow">{weekRangeLabel}</p>
              <h3>Section distribution</h3>
            </div>
          </div>
          <WeeklyPieChart
            items={data.analytics.section_distribution}
            totalValue={data.analytics.days_this_week}
            totalLabel="days"
            emptyLabel={`Nothing logged for ${weekRangeLabel} yet`}
            totalFormatter={(value) => `${value}/7`}
          />
        </motion.section>
      </div>

      <motion.section className="surface-card" {...panelReveal}>
        <button
          type="button"
          className="surface-toggle"
          onClick={() => setShowWeekSessions((current) => !current)}
        >
          <div>
            <p className="eyebrow">{weekRangeLabel}</p>
            <h3>This week</h3>
          </div>
          <div className="module-toggle-meta">
            <span>{data.analytics.days_this_week} / 7</span>
            <ChevronDown className={showWeekSessions ? "open" : ""} size={18} />
          </div>
        </button>

        {showWeekSessions ? (
          <div className="toggle-panel session-list">
            {thisWeekSessions.map((session) => (
              <div key={session.id} className="session-card">
                <div>
                  <strong>{formatSessionDate(session.session_date)}</strong>
                  <p>{session.sections.map((section) => section.name).join(", ") || "No type"}</p>
                  {session.notes ? <small>{session.notes}</small> : null}
                </div>
              </div>
            ))}
            {thisWeekSessions.length === 0 ? (
              <div className="empty-state">
                <h4>No sessions for {weekRangeLabel}.</h4>
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.section>

      <motion.section className="surface-card" {...panelReveal}>
        <div className="surface-header">
          <div>
            <h3>Current material</h3>
          </div>
        </div>

        <div className="guitar-material-list">
          {data.materials.map((material) => (
            <MaterialRow
              key={material.id}
              material={material}
              deltaBluesGroup={deltaBluesGroup}
              songGroups={data.song_groups}
              open={Boolean(openMaterials[material.id])}
              onToggle={() =>
                setOpenMaterials((current) => ({
                  ...current,
                  [material.id]: !current[material.id],
                }))
              }
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </motion.section>

      <motion.section className="surface-card" {...panelReveal}>
        <button
          type="button"
          className="surface-toggle"
          onClick={() => setShowHistory((current) => !current)}
        >
          <div>
            <h3>History</h3>
          </div>
          <ChevronDown className={showHistory ? "open" : ""} size={18} />
        </button>

        {showHistory ? (
          <div className="toggle-panel session-list">
            {data.sessions.map((session) => (
              <div key={session.id} className="session-card">
                <div>
                  <strong>{formatSessionDate(session.session_date)}</strong>
                  <p>{session.sections.map((section) => section.name).join(", ") || "No type"}</p>
                  {session.notes ? <small>{session.notes}</small> : null}
                </div>
                <button
                  className="icon-button danger"
                  onClick={async () => {
                    await api.deleteSession("guitar", session.id);
                    await onRefresh();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {data.sessions.length === 0 ? (
              <div className="empty-state">
                <h4>No sessions yet.</h4>
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.section>
    </section>
  );
}

function MaterialRow({
  material,
  deltaBluesGroup,
  songGroups,
  open,
  onToggle,
  onRefresh,
}: {
  material: GuitarResponse["materials"][number];
  deltaBluesGroup: GuitarResponse["song_groups"][number] | null;
  songGroups: GuitarResponse["song_groups"];
  open: boolean;
  onToggle: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(material.notes);
  const [classicalFields, setClassicalFields] = useState(() =>
    parseClassicalMaterialNotes(material.notes),
  );
  const [cagedFields, setCagedFields] = useState(() => parseCagedMaterialNotes(material.notes));

  useEffect(() => {
    setNotes(material.notes);
    setClassicalFields(parseClassicalMaterialNotes(material.notes));
    setCagedFields(parseCagedMaterialNotes(material.notes));
  }, [material.notes]);

  const isClassicalMaterial = material.title.trim().toLowerCase() === "classical";
  const isCagedMaterial = material.title.trim().toLowerCase() === "caged";
  const isDeltaBluesMaterial = material.title.trim().toLowerCase() === "delta blues";
  const isSongsMaterial = material.title.trim().toLowerCase() === "songs";

  async function saveMaterial() {
    const nextNotes = isClassicalMaterial
      ? serializeClassicalMaterialNotes(classicalFields)
      : isCagedMaterial
        ? serializeCagedMaterialNotes(cagedFields)
        : notes;
    if (nextNotes === material.notes) {
      return;
    }
    await api.updateGuitarMaterial(material.id, { notes: nextNotes });
    await onRefresh();
  }

  async function commitClassicalField(field: "pagesOn" | "pagesReviewing", value: string) {
    const updated = { ...classicalFields, [field]: value };
    setClassicalFields(updated);
    await api.updateGuitarMaterial(material.id, {
      notes: serializeClassicalMaterialNotes(updated),
    });
    await onRefresh();
  }

  return (
    <div className="surface-card guitar-material-card">
      <button type="button" className="surface-toggle" onClick={onToggle}>
        <div>
          <h3>{material.title}</h3>
        </div>
        <div className="module-toggle-meta">
          <ChevronDown className={open ? "open" : ""} size={18} />
        </div>
      </button>

      {open ? (
        <div className="toggle-panel guitar-material-body">
          {isClassicalMaterial ? (
            <div className="guitar-classical-grid">
              <StepperField
                label="Pages I'm reviewing"
                value={classicalFields.pagesReviewing}
                onCommit={(v) => void commitClassicalField("pagesReviewing", v)}
              />
              <StepperField
                label="Pages I'm on"
                value={classicalFields.pagesOn}
                onCommit={(v) => void commitClassicalField("pagesOn", v)}
              />
            </div>
          ) : isCagedMaterial ? (
            <div className="guitar-caged-grid">
              <CagedChordBrowser />
              <label>
                <span className="metric-label">Regulars</span>
                <textarea
                  rows={4}
                  value={cagedFields.regulars}
                  onChange={(event) =>
                    setCagedFields((current) => ({
                      ...current,
                      regulars: event.target.value,
                    }))
                  }
                  onBlur={() => void saveMaterial()}
                  placeholder="Regular shapes, notes, or reminders..."
                />
              </label>

              <label>
                <span className="metric-label">7ths</span>
                <textarea
                  rows={4}
                  value={cagedFields.sevenths}
                  onChange={(event) =>
                    setCagedFields((current) => ({
                      ...current,
                      sevenths: event.target.value,
                    }))
                  }
                  onBlur={() => void saveMaterial()}
                  placeholder="7th shapes or voicing notes..."
                />
              </label>

              <label>
                <span className="metric-label">9ths</span>
                <textarea
                  rows={4}
                  value={cagedFields.ninths}
                  onChange={(event) =>
                    setCagedFields((current) => ({
                      ...current,
                      ninths: event.target.value,
                    }))
                  }
                  onBlur={() => void saveMaterial()}
                  placeholder="9th shapes or voicing notes..."
                />
              </label>
            </div>
          ) : isDeltaBluesMaterial ? (
            <DeltaBluesMaterial
              group={deltaBluesGroup}
              onRefresh={onRefresh}
            />
          ) : isSongsMaterial ? (
            <SongsMaterial groups={songGroups} onRefresh={onRefresh} />
          ) : (
            <label>
              <span className="metric-label">Notes</span>
              <textarea
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={() => void saveMaterial()}
                placeholder="Put the information you want to reference while practicing..."
              />
            </label>
          )}

          {isDeltaBluesMaterial || isSongsMaterial || isClassicalMaterial ? null : (
            <div className="editor-actions">
              <button className="secondary-button" type="button" onClick={() => void saveMaterial()}>
                Save notes
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SongsMaterial({
  groups,
  onRefresh,
}: {
  groups: GuitarResponse["song_groups"];
  onRefresh: () => Promise<void>;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const visibleGroups = groups.filter((group) => group.name.trim().toLowerCase() !== "delta blues");

  return selectedGroup ? (
    <SongGroupBrowser group={selectedGroup} onBack={() => setSelectedGroupId(null)} onRefresh={onRefresh} />
  ) : (
    <div className="guitar-song-browser">
      <div className="guitar-song-category-grid">
        {visibleGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            className="guitar-song-category-card"
            onClick={() => setSelectedGroupId(group.id)}
          >
            <span>{group.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SongGroupBrowser({
  group,
  onBack,
  onRefresh,
}: {
  group: GuitarResponse["song_groups"][number];
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitSong(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    setBusy(true);
    try {
      await api.createGuitarSong(group.id, title.trim());
      setTitle("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="guitar-song-browser">
      <div className="guitar-song-browser-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
        <h4>{group.name}</h4>
      </div>

      <div className="guitar-delta-song-grid">
        {group.songs.map((song) => (
          <DeltaBluesSongCard key={song.id} song={song} onRefresh={onRefresh} />
        ))}
      </div>
      {group.songs.length === 0 ? (
        <div className="empty-state">
          <h4>No songs here yet.</h4>
        </div>
      ) : null}

      <form className="task-entry guitar-delta-entry" onSubmit={submitSong}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`Add ${group.name.toLowerCase()} song...`}
        />
        <button type="submit" disabled={busy}>
          <Plus size={16} />
          Add
        </button>
      </form>
    </div>
  );
}

function DeltaBluesMaterial({
  group,
  onRefresh,
}: {
  group: GuitarResponse["song_groups"][number] | null;
  onRefresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitSong(event: FormEvent) {
    event.preventDefault();
    if (!group || !title.trim()) {
      return;
    }
    setBusy(true);
    try {
      await api.createGuitarSong(group.id, title.trim());
      setTitle("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  if (!group) {
    return (
      <div className="empty-state">
        <h4>Delta Blues songs folder is missing.</h4>
      </div>
    );
  }

  return (
    <div className="guitar-delta-grid">
      <div className="guitar-delta-song-grid">
        {group.songs.map((song) => (
          <DeltaBluesSongCard key={song.id} song={song} onRefresh={onRefresh} />
        ))}
      </div>
      {group.songs.length === 0 ? (
        <div className="empty-state">
          <h4>No delta blues songs yet.</h4>
        </div>
      ) : null}

      <form className="task-entry guitar-delta-entry" onSubmit={submitSong}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add delta blues song..."
        />
        <button type="submit" disabled={busy}>
          <Plus size={16} />
          Add
        </button>
      </form>
    </div>
  );
}

function DeltaBluesSongCard({
  song,
  onRefresh,
}: {
  song: GuitarResponse["song_groups"][number]["songs"][number];
  onRefresh: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      await api.uploadGuitarSongFile(song.id, file);
      event.target.value = "";
      await onRefresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="guitar-delta-song-card">
      <div className="guitar-delta-song-header">
        <span>{song.title}</span>
        <button
          type="button"
          className="icon-button subtle"
          onClick={async () => {
            await api.deleteGuitarSong(song.id);
            await onRefresh();
          }}
          aria-label={`Delete ${song.title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="guitar-delta-song-meta">
        <span>{song.files.length} PDF{song.files.length === 1 ? "" : "s"}</span>
      </div>

      <label className="secondary-button guitar-upload-button">
        <input
          className="guitar-hidden-file-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => void uploadFile(event)}
        />
        <FileText size={16} />
        {uploading ? "Uploading..." : "Upload PDF"}
      </label>

      {song.files.length ? (
        <div className="guitar-delta-file-list">
          {song.files.map((file) => (
            <button
              key={file.id}
              type="button"
              className="guitar-delta-file-pill"
              onClick={() =>
                window.open(
                  `${API_BASE}/api/guitar/song-files/${file.id}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              {file.display_name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CagedChordBrowser() {
  const [keyIdx, setKeyIdx] = useState(0);
  const total = KEY_LABELS.length;

  const positions = getCAGEDPositions(keyIdx);

  function prevKey() { setKeyIdx((i) => (i - 1 + total) % total); }
  function nextKey() { setKeyIdx((i) => (i + 1) % total); }

  function posLabel(p: CagedPosition) {
    return p.chord.includes("o") ? `${p.shape} · open` : `${p.shape} · fr.${p.startFret}`;
  }

  return (
    <div className="chord-browser">
      <div className="chord-browser-nav">
        <button className="icon-button chord-nav-btn" onClick={prevKey} aria-label="Previous chord">
          <ChevronLeft size={18} />
        </button>
        <span className="chord-browser-label">{KEY_LABELS[keyIdx]} Major</span>
        <button className="icon-button chord-nav-btn" onClick={nextKey} aria-label="Next chord">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="chord-browser-dots">
        {KEY_LABELS.map((_, i) => (
          <button
            key={i}
            className={`chord-dot-btn${i === keyIdx ? " active" : ""}`}
            onClick={() => setKeyIdx(i)}
          />
        ))}
      </div>
      <div className="chord-pos-row">
        {positions.map((p) => (
          <ChordDiagram
            key={`${keyIdx}-${p.shape}`}
            label={posLabel(p)}
            defaultChord={p.chord}
            startFret={p.startFret}
          />
        ))}
      </div>
    </div>
  );
}

function ChordDiagram({
  label,
  defaultChord,
  startFret = 1,
}: {
  label: string;
  defaultChord: ChordValue[];
  startFret?: number;
}) {
  const [chord, setChord] = useState<ChordValue[]>(defaultChord);
  const [hover, setHover] = useState<{ s: number; f: number } | null>(null);

  function handleFretClick(s: number, f: number) {
    setChord((prev) => {
      const next = [...prev] as ChordValue[];
      next[s] = next[s] === f ? "o" : (f as ChordValue);
      return next;
    });
  }

  const STRING_WIDTHS = [2, 1.8, 1.5, 1.3, 1.1, 1];

  const fretboardTop = CD_NUT_Y;
  const fretboardBottom = cdFretLineY(CD_NUM_FRETS);
  const fretboardLeft = cdStringX(0);
  const fretboardRight = cdStringX(5);

  return (
    <div className="chord-diagram">
      <span className="chord-diagram-label">{label}</span>
      <svg
        viewBox={`0 0 ${CD_W} ${CD_H}`}
        width={CD_W}
        height={CD_H}
        className="chord-diagram-svg"
        aria-label={`${label} chord diagram`}
      >
        {/* Fretboard background */}
        <rect
          x={fretboardLeft} y={fretboardTop}
          width={fretboardRight - fretboardLeft}
          height={fretboardBottom - fretboardTop}
          fill="rgba(255,255,255,0.03)"
        />

        {/* Nut (thick) or open-position marker (thin) + fret label */}
        {startFret === 1 ? (
          <line
            x1={fretboardLeft} y1={CD_NUT_Y}
            x2={fretboardRight} y2={CD_NUT_Y}
            style={{ stroke: "rgba(255,255,255,0.9)", strokeWidth: 5, strokeLinecap: "round" }}
          />
        ) : (
          <>
            <line
              x1={fretboardLeft} y1={CD_NUT_Y}
              x2={fretboardRight} y2={CD_NUT_Y}
              style={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1.5 }}
            />
            <text
              x={fretboardRight + 10} y={CD_NUT_Y + 5}
              fontSize={11} fontWeight="600"
              style={{ fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
            >
              {startFret}fr
            </text>
          </>
        )}

        {/* Fret lines */}
        {Array.from({ length: CD_NUM_FRETS }, (_, i) => (
          <line key={i}
            x1={fretboardLeft} y1={cdFretLineY(i + 1)}
            x2={fretboardRight} y2={cdFretLineY(i + 1)}
            style={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: 1.5 }}
          />
        ))}

        {/* String lines */}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s}
            x1={cdStringX(s)} y1={fretboardTop}
            x2={cdStringX(s)} y2={fretboardBottom}
            style={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: STRING_WIDTHS[s] }}
          />
        ))}

        {/* Fret number labels */}
        {Array.from({ length: CD_NUM_FRETS }, (_, f) => (
          <text key={f}
            x={fretboardLeft - 12} y={cdDotY(f + 1) + 4}
            textAnchor="middle" fontSize={10}
            style={{ fill: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}
          >
            {f + 1}
          </text>
        ))}

        {/* Fret click zones + dots */}
        {Array.from({ length: 6 }, (_, s) =>
          Array.from({ length: CD_NUM_FRETS }, (_, fi) => {
            const fret = fi + 1;
            const isActive = chord[s] === fret;
            const isHovered = hover?.s === s && hover?.f === fret;
            return (
              <g key={`${s}-${fret}`}>
                <rect
                  x={cdStringX(s) - CD_S_SPACE / 2} y={cdFretLineY(fi)}
                  width={CD_S_SPACE} height={CD_FRET_H}
                  fill="transparent" style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover({ s, f: fret })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => handleFretClick(s, fret)}
                />
                {(isActive || isHovered) && (
                  <circle
                    cx={cdStringX(s)} cy={cdDotY(fret)} r={CD_DOT_R}
                    style={{
                      fill: isActive ? "var(--accent)" : "rgba(255,255,255,0.15)",
                      stroke: isActive ? "none" : "rgba(255,255,255,0.3)",
                      strokeWidth: 1.5,
                    }}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })
        )}

        {/* Indicators above nut (x / o) — display only, not interactive */}
        {Array.from({ length: 6 }, (_, s) => {
          const val = chord[s];
          const x = cdStringX(s);
          return (
            <g key={s} style={{ cursor: "default" }}>
              {val === "o" ? (
                <circle cx={x} cy={CD_IND_Y} r={7}
                  style={{ fill: "none", stroke: "rgba(255,255,255,0.75)", strokeWidth: 2 }}
                />
              ) : val === "x" ? (
                <>
                  <line x1={x - 5} y1={CD_IND_Y - 5} x2={x + 5} y2={CD_IND_Y + 5}
                    style={{ stroke: "rgba(255,255,255,0.5)", strokeWidth: 2, strokeLinecap: "round" }}
                  />
                  <line x1={x + 5} y1={CD_IND_Y - 5} x2={x - 5} y2={CD_IND_Y + 5}
                    style={{ stroke: "rgba(255,255,255,0.5)", strokeWidth: 2, strokeLinecap: "round" }}
                  />
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StepperField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  const num = parseInt(local, 10) || 0;

  function decrement() {
    const next = String(Math.max(0, num - 1));
    setLocal(next);
    onCommit(next);
  }

  function increment() {
    const next = String(num + 1);
    setLocal(next);
    onCommit(next);
  }

  return (
    <div className="stepper-field">
      <span className="metric-label">{label}</span>
      <div className="stepper-control">
        <button type="button" className="stepper-btn" onClick={decrement} aria-label="Decrease">
          <Minus size={14} />
        </button>
        <input
          type="text"
          className="stepper-input"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onCommit(local)}
        />
        <button type="button" className="stepper-btn" onClick={increment} aria-label="Increase">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

function formatSessionDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function autoResizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = "0px";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function handleNotesTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Tab") {
    return;
  }
  event.preventDefault();
  const textarea = event.currentTarget;
  const { selectionStart, selectionEnd, value } = textarea;
  const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
  textarea.value = nextValue;
  textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function parseClassicalMaterialNotes(notes: string) {
  const reviewingBlock = extractTaggedBlock(notes, "Pages reviewing");
  const onBlock = extractTaggedBlock(notes, "Pages on");

  if (reviewingBlock !== null || onBlock !== null) {
    return {
      pagesOn: onBlock ?? "",
      pagesReviewing: reviewingBlock ?? "",
    };
  }

  const lines = notes.split("\n");
  const pagesOnLine = lines.find((line) => line.startsWith("Pages on:")) ?? "";
  const pagesReviewingLine = lines.find((line) => line.startsWith("Pages reviewing:")) ?? "";

  return {
    pagesOn: pagesOnLine.replace("Pages on:", "").trim(),
    pagesReviewing: pagesReviewingLine.replace("Pages reviewing:", "").trim(),
  };
}

function serializeClassicalMaterialNotes(fields: {
  pagesOn: string;
  pagesReviewing: string;
}) {
  return [
    `[[Pages reviewing]]`,
    fields.pagesReviewing.trim(),
    `[[/Pages reviewing]]`,
    `[[Pages on]]`,
    fields.pagesOn.trim(),
    `[[/Pages on]]`,
  ].join("\n");
}

function extractTaggedBlock(source: string, label: string) {
  const startTag = `[[${label}]]`;
  const endTag = `[[/${label}]]`;
  const startIndex = source.indexOf(startTag);
  const endIndex = source.indexOf(endTag);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  return source
    .slice(startIndex + startTag.length, endIndex)
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

function parseCagedMaterialNotes(notes: string) {
  const lines = notes.split("\n");
  const regularsLine = lines.find((line) => line.startsWith("Regulars:")) ?? "";
  const seventhsLine = lines.find((line) => line.startsWith("7ths:")) ?? "";
  const ninthsLine = lines.find((line) => line.startsWith("9ths:")) ?? "";

  return {
    regulars: regularsLine.replace("Regulars:", "").trim(),
    sevenths: seventhsLine.replace("7ths:", "").trim(),
    ninths: ninthsLine.replace("9ths:", "").trim(),
  };
}

function serializeCagedMaterialNotes(fields: {
  regulars: string;
  sevenths: string;
  ninths: string;
}) {
  return [
    `Regulars: ${fields.regulars.trim()}`,
    `7ths: ${fields.sevenths.trim()}`,
    `9ths: ${fields.ninths.trim()}`,
  ].join("\n");
}
