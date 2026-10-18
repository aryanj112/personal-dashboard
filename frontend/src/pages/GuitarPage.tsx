import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, GripVertical, Minus, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { ChangeEvent, DragEvent as ReactDragEvent, FormEvent, Fragment, KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WeeklyPieChart } from "../components/Charts";
import { API_BASE, api } from "../lib/api";
import {
  CAGED_CHORDS,
  CAGED_KEYS,
  type CagedChordPosition,
  type CagedChordType,
  type ChordFret,
} from "../lib/cagedChords";
import { chordDegreeLabels } from "../lib/chordDegrees";
import { getCurrentWeekBounds, getCurrentWeekRangeLabel } from "../lib/dates";
import type { GuitarResponse } from "../lib/types";

// ── Chord diagram ────────────────────────────────────────────────
type ChordValue = ChordFret;
type CagedPosition = CagedChordPosition;
const KEY_LABELS = CAGED_KEYS;
const CAGED_ROOT_INDICES = [0, 9, 7, 4, 2];

function useChordRootNavigation() {
  const [cagedOnly, setCagedOnly] = useState(false);
  const [rootPosition, setRootPosition] = useState(0);
  const rootIndices = cagedOnly ? CAGED_ROOT_INDICES : KEY_LABELS.map((_, index) => index);
  const keyIdx = rootIndices[rootPosition] ?? 0;

  return {
    cagedOnly,
    keyIdx,
    rootIndices,
    moveRoot: (amount: number) => {
      setRootPosition((position) => (position + amount + rootIndices.length) % rootIndices.length);
    },
    selectRoot: (position: number) => setRootPosition(position),
    toggleCagedOnly: () => {
      setRootPosition(0);
      setCagedOnly((current) => !current);
    },
  };
}

type NoteLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
type Accidental = -1 | 0 | 1;
type TheoryNote = { letter: NoteLetter; accidental: Accidental; pitchClass: number };
type TheoryQuestion = { root: TheoryNote; target: TheoryNote; quality: "major" | "minor" };

const NOTE_LETTERS: NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PITCH_CLASSES: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

function normalizePitchClass(value: number) {
  return (value + 12) % 12;
}

function getAccidentalForPitchClass(pitchClass: number, letter: NoteLetter): Accidental | null {
  const distance = ((pitchClass - NATURAL_PITCH_CLASSES[letter] + 18) % 12) - 6;
  return distance >= -1 && distance <= 1 ? distance as Accidental : null;
}

function formatTheoryNote(note: Pick<TheoryNote, "letter" | "accidental">) {
  const accidental = note.accidental === -1 ? "♭" : note.accidental === 1 ? "♯" : "";
  return `${note.letter}${accidental}`;
}

function createTheoryQuestion(): TheoryQuestion {
  const questions: TheoryQuestion[] = [];

  for (const quality of ["major", "minor"] as const) {
    const semitones = quality === "major" ? 4 : 3;
    for (const letter of NOTE_LETTERS) {
      for (const accidental of [-1, 0, 1] as Accidental[]) {
        const rootPitchClass = normalizePitchClass(NATURAL_PITCH_CLASSES[letter] + accidental);
        const targetLetter = NOTE_LETTERS[(NOTE_LETTERS.indexOf(letter) + 2) % NOTE_LETTERS.length];
        const targetPitchClass = normalizePitchClass(rootPitchClass + semitones);
        const targetAccidental = getAccidentalForPitchClass(targetPitchClass, targetLetter);

        if (targetAccidental !== null) {
          questions.push({
            quality,
            root: { letter, accidental, pitchClass: rootPitchClass },
            target: { letter: targetLetter, accidental: targetAccidental, pitchClass: targetPitchClass },
          });
        }
      }
    }
  }

  return questions[Math.floor(Math.random() * questions.length)];
}

type ChordTypeConfig = {
  id: CagedChordType;
  label: string;
  nameFn: (key: string) => string;
  /** Semitones above the root. Degree labels are derived from this. */
  intervals: number[];
};

const CHORD_TYPES: ChordTypeConfig[] = [
  { id: "major", label: "Major", nameFn: (key) => `${key} Major`, intervals: [0, 4, 7] },
  { id: "minor", label: "Minor", nameFn: (key) => `${key} Minor`, intervals: [0, 3, 7] },
  { id: "m7", label: "m7", nameFn: (key) => `${key}m7`, intervals: [0, 3, 7, 10] },
  { id: "dom7", label: "7", nameFn: (key) => `${key}7`, intervals: [0, 4, 7, 10] },
  { id: "maj7", label: "maj7", nameFn: (key) => `${key}maj7`, intervals: [0, 4, 7, 11] },
  { id: "m7b5", label: "m7♭5", nameFn: (key) => `${key}m7♭5`, intervals: [0, 3, 6, 10] },
];

function getChordPositions(keyIdx: number, chordType: CagedChordType): readonly CagedPosition[] {
  return CAGED_CHORDS[chordType][KEY_LABELS[keyIdx]];
}

/**
 * A chord name that reveals the chord's scale degrees on hover/focus. Every
 * chord browser uses this, so the degrees stay consistent across chord types.
 */
function ChordNameWithDegrees({
  name,
  intervals,
  tooltipId,
  className,
}: {
  name: string;
  intervals: number[];
  tooltipId: string;
  className: string;
}) {
  // Stacked like the chord sounds: root on the bottom, each degree above it.
  const stacked = chordDegreeLabels(intervals)
    .map((degree, index) => ({ degree, semitone: intervals[index] }))
    .reverse();

  return (
    <span className={`${className} chord-row-type-label-tooltip`} tabIndex={0} aria-describedby={tooltipId}>
      {name}
      <span id={tooltipId} role="tooltip" className="chord-row-interval-tooltip">
        {stacked.map(({ degree, semitone }) => (
          <span key={`${tooltipId}-${semitone}`}>{degree}</span>
        ))}
      </span>
    </span>
  );
}

// SVG metrics
const CD_W = 210;
const CD_H = 278;
const CD_START_X = 30;
const CD_S_SPACE = 28;
const CD_NUT_Y = 58;
const CD_FRET_H = 40;
const CD_NUM_FRETS = 5;
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
    section_ids: [] as number[],
  });
  const [showWeekSessions, setShowWeekSessions] = useState(false);
  const [openMaterials, setOpenMaterials] = useState<Record<number, boolean>>({});
  const dateSessions = data.sessions.filter((session) => session.session_date === form.date);
  const existingDateSession = dateSessions[0] ?? null;
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
      section_ids: form.section_ids,
    });
    setForm({
      date: todayString,
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
                onChange={(event) => {
                  const date = event.target.value;
                  const sections = data.sessions
                    .filter((session) => session.session_date === date)
                    .flatMap((session) => session.sections.map((section) => section.id));
                  setForm({ date, section_ids: [...new Set(sections)] });
                }}
              />
            </label>

            {existingDateSession ? (
              <p className="field-caption">Add practice areas to your existing session</p>
            ) : null}

            <div className="field-group">
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
              {existingDateSession ? "Add to session" : "Save session"}
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

      <motion.section className="guitar-material-section" {...panelReveal}>
        <h3 className="guitar-material-heading">Current material</h3>

        <div className="guitar-material-list">
          {data.materials.map((material) => (
            <Fragment key={material.id}>
              <MaterialRow
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
              {material.title.trim().toLowerCase() === "arps" ? <TheoryMaterial /> : null}
            </Fragment>
          ))}
        </div>
      </motion.section>

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
              <GuitarWeekSessionCard
                key={session.id}
                session={session}
                sections={data.sections}
                onRefresh={onRefresh}
              />
            ))}
            {thisWeekSessions.length === 0 ? (
              <div className="empty-state">
                <h4>No sessions for {weekRangeLabel}.</h4>
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.section>
    </section>
  );
}

function GuitarWeekSessionCard({
  session,
  sections,
  onRefresh,
}: {
  session: GuitarResponse["sessions"][number];
  sections: GuitarResponse["sections"];
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [sectionIds, setSectionIds] = useState(session.sections.map((section) => section.id));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setSectionIds(session.sections.map((section) => section.id));
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateSession("guitar", session.id, {
        date: session.session_date,
        duration_minutes: session.duration_minutes,
        section_ids: sectionIds,
      });
      setEditing(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="session-card session-card-editor">
        <strong>{formatSessionDate(session.session_date)}</strong>
        <div className="field-group">
          <span className="field-caption">Practice areas</span>
          <div className="chip-grid">
            {sections.map((section) => {
              const active = sectionIds.includes(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`chip ${active ? "active" : ""}`}
                  onClick={() => setSectionIds((current) => (
                    active
                      ? current.filter((id) => id !== section.id)
                      : [...current, section.id]
                  ))}
                >
                  {section.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="editor-actions">
          <button className="secondary-button" type="button" onClick={() => setEditing(false)} disabled={saving}>
            <X size={16} />
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>
            <Check size={16} />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-card">
      <div>
        <strong>{formatSessionDate(session.session_date)}</strong>
        <p>{session.sections.map((section) => section.name).join(", ") || "No type"}</p>
      </div>
      <button
        type="button"
        className="icon-button"
        onClick={startEditing}
        aria-label={`Edit guitar practice for ${formatSessionDate(session.session_date)}`}
        title="Edit practice"
      >
        <Pencil size={15} />
      </button>
    </div>
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
  const isNotesFreeMaterial = ["arps", "ear training", "speed sequences"].includes(
    material.title.trim().toLowerCase(),
  );

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
              <h4 className="caged-section-header">Major</h4>
              <MajorBrowser />
              <h4 className="caged-section-header">Minor</h4>
              <MinorBrowser />
              <h4 className="caged-section-header">7ths</h4>
              <SeventhsBrowser />
            </div>
          ) : isDeltaBluesMaterial ? (
            <DeltaBluesMaterial
              group={deltaBluesGroup}
              onRefresh={onRefresh}
            />
          ) : isSongsMaterial ? (
            <SongsMaterial groups={songGroups} onRefresh={onRefresh} />
          ) : isNotesFreeMaterial ? null : (
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

          {isDeltaBluesMaterial || isSongsMaterial || isClassicalMaterial || isCagedMaterial || isNotesFreeMaterial ? null : (
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

function TheoryMaterial() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(() => createTheoryQuestion());
  const [selectedLetter, setSelectedLetter] = useState<NoteLetter | null>(null);
  const [selectedAccidental, setSelectedAccidental] = useState<Accidental | null>(null);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState({ correct: 0, attempted: 0 });

  function clearAnswer() {
    setSelectedLetter(null);
    setSelectedAccidental(null);
    setResult(null);
  }

  function showNextQuestion() {
    setQuestion(createTheoryQuestion());
    clearAnswer();
  }

  function submitAnswer() {
    if (selectedLetter === null || selectedAccidental === null) {
      return;
    }

    const isCorrect =
      selectedLetter === question.target.letter && selectedAccidental === question.target.accidental;
    setScore((current) => ({
      correct: current.correct + (isCorrect ? 1 : 0),
      attempted: current.attempted + 1,
    }));
    setResult(isCorrect ? "correct" : "incorrect");
  }

  function restartScore() {
    setScore({ correct: 0, attempted: 0 });
    showNextQuestion();
  }

  return (
    <section className="surface-card guitar-material-card guitar-theory-card">
      <div className="theory-card-header">
        <button
          type="button"
          className="surface-toggle theory-toggle"
          aria-expanded={open}
          aria-controls="guitar-theory-quiz"
          onClick={() => setOpen((current) => !current)}
        >
          <h3>Theory</h3>
          <ChevronDown className={open ? "open" : ""} size={18} />
        </button>
      </div>

      {open ? (
        <>
          <div className="theory-card-header theory-expanded-header">
            <div className="theory-score">
              <span>Score</span>
              <strong>{score.correct} / {score.attempted}</strong>
            </div>
            <button
              type="button"
              className="icon-button subtle"
              onClick={restartScore}
              aria-label="Restart score"
              title="Restart score"
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className="theory-quiz" id="guitar-theory-quiz">
        <div className="theory-question">
          <span>What note is a {question.quality} 3rd above</span>
          <strong>{formatTheoryNote(question.root)}?</strong>
        </div>

        <div className="theory-choice-group">
          <span className="field-caption">Note</span>
          <div className="theory-note-choices">
            {NOTE_LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`theory-choice${selectedLetter === letter ? " active" : ""}`}
                aria-pressed={selectedLetter === letter}
                disabled={result !== null}
                onClick={() => setSelectedLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        <div className="theory-choice-group">
          <span className="field-caption">Accidental</span>
          <div className="theory-accidental-choices">
            {([
              [-1, "♭", "Flat"],
              [0, "♮", "Natural"],
              [1, "♯", "Sharp"],
            ] as const).map(([accidental, symbol, label]) => (
              <button
                key={label}
                type="button"
                className={`theory-choice theory-accidental-choice${selectedAccidental === accidental ? " active" : ""}`}
                aria-label={label}
                aria-pressed={selectedAccidental === accidental}
                disabled={result !== null}
                onClick={() => setSelectedAccidental(accidental)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>

        {result ? (
          <div className={`theory-result ${result}`}>
            {result === "correct" ? "Correct." : `Answer: ${formatTheoryNote(question.target)}.`}
          </div>
        ) : null}

        <div className="theory-actions">
          {result ? (
            <button type="button" className="primary-button" onClick={showNextQuestion}>
              Next question
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={selectedLetter === null || selectedAccidental === null}
              onClick={submitAnswer}
            >
              Submit
            </button>
          )}
        </div>
          </div>
        </>
      ) : null}
    </section>
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

      <SortableSongGrid group={group} onRefresh={onRefresh} />

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
      <SortableSongGrid group={group} onRefresh={onRefresh} />
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

function SortableSongGrid({
  group,
  onRefresh,
}: {
  group: GuitarResponse["song_groups"][number];
  onRefresh: () => Promise<void>;
}) {
  const [songs, setSongs] = useState(group.songs);
  const [draggingSongId, setDraggingSongId] = useState<number | null>(null);
  const [dropTargetSongId, setDropTargetSongId] = useState<number | null>(null);
  const dragSongId = useRef<number | null>(null);

  useEffect(() => setSongs(group.songs), [group.songs]);

  function handleDragStart(event: ReactDragEvent<HTMLDivElement>, songId: number) {
    dragSongId.current = songId;
    setDraggingSongId(songId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(songId));
  }

  function handleDragOver(event: ReactDragEvent<HTMLDivElement>, songId: number) {
    event.preventDefault();
    setDropTargetSongId(songId);
  }

  async function handleDrop(event: ReactDragEvent<HTMLDivElement>, targetSongId: number) {
    event.preventDefault();
    const sourceSongId = dragSongId.current;
    dragSongId.current = null;
    setDraggingSongId(null);
    setDropTargetSongId(null);
    if (sourceSongId === null || sourceSongId === targetSongId) return;

    const nextSongs = [...songs];
    const sourceIndex = nextSongs.findIndex((song) => song.id === sourceSongId);
    const targetIndex = nextSongs.findIndex((song) => song.id === targetSongId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [movedSong] = nextSongs.splice(sourceIndex, 1);
    nextSongs.splice(targetIndex, 0, movedSong);
    setSongs(nextSongs);

    try {
      await api.reorderGuitarSongs(group.id, nextSongs.map((song) => song.id));
      await onRefresh();
    } catch {
      await onRefresh();
    }
  }

  return (
    <div className="guitar-delta-song-grid">
      {songs.map((song) => (
        <SongFileCard
          key={song.id}
          song={song}
          onRefresh={onRefresh}
          dragging={draggingSongId === song.id}
          dropTarget={dropTargetSongId === song.id && draggingSongId !== song.id}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={() => {
            dragSongId.current = null;
            setDraggingSongId(null);
            setDropTargetSongId(null);
          }}
        />
      ))}
    </div>
  );
}

function SongFileCard({
  song,
  onRefresh,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  song: GuitarResponse["song_groups"][number]["songs"][number];
  onRefresh: () => Promise<void>;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (event: ReactDragEvent<HTMLDivElement>, songId: number) => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>, songId: number) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>, songId: number) => void;
  onDragEnd: () => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [pageStart, setPageStart] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const maxPageStart = Math.max(0, Math.floor((song.files.length - 1) / 2) * 2);

  useEffect(() => {
    setPageStart((current) => Math.min(current, maxPageStart));
  }, [maxPageStart]);

  useEffect(() => {
    if (!viewerOpen) return;
    const handleKeyDown = (event: Event) => {
      if (!(event instanceof window.KeyboardEvent)) return;
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") setPageStart((current) => Math.max(0, current - 2));
      if (event.key === "ArrowRight") setPageStart((current) => Math.min(maxPageStart, current + 2));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maxPageStart, viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        await api.uploadGuitarSongFile(song.id, file);
      }
      setPageStart(0);
      await onRefresh();
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function deleteFile(fileId: number) {
    setDeletingFileId(fileId);
    try {
      await api.deleteGuitarSongFile(fileId);
      setPageStart(0);
      await onRefresh();
    } finally {
      setDeletingFileId(null);
    }
  }

  const visibleFiles = song.files.slice(pageStart, pageStart + 2);

  return (
    <>
      <div
        className={`guitar-delta-song-card${dragging ? " dragging" : ""}${dropTarget ? " drop-target" : ""}`}
        draggable
        onDragStart={(event) => onDragStart(event, song.id)}
        onDragOver={(event) => onDragOver(event, song.id)}
        onDrop={(event) => void onDrop(event, song.id)}
        onDragEnd={onDragEnd}
      >
        <div className="guitar-delta-song-header">
          <div className="guitar-song-title-button">
            <GripVertical className="guitar-song-drag-handle" size={16} aria-hidden="true" />
            <FileText size={16} />
            <span>{song.title}</span>
          </div>
        </div>
        <div className="guitar-delta-song-actions">
          <button
            type="button"
            className="secondary-button guitar-song-view-button"
            onClick={() => {
              setPageStart(0);
              setZoomPercent(100);
              setViewerOpen(true);
            }}
          >
            <Eye size={15} />
            View
          </button>
          <label className={`secondary-button guitar-song-card-upload${uploading ? " disabled" : ""}`}>
            <input
              className="guitar-hidden-file-input"
              type="file"
              accept="application/pdf,.pdf,image/png,.png"
              multiple
              disabled={uploading}
              onChange={(event) => void uploadFiles(event)}
            />
            <Plus size={15} />
            Add files
          </label>
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
      </div>

      {viewerOpen ? createPortal(
        <div
          className="song-pdf-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewerOpen(false);
          }}
        >
          <section className="song-pdf-viewer" role="dialog" aria-modal="true" aria-labelledby={`song-pdf-title-${song.id}`}>
            <header className="song-pdf-header">
              <div className="song-pdf-heading">
                <h3 id={`song-pdf-title-${song.id}`}>{song.title}</h3>
                <span>{song.files.length} file{song.files.length === 1 ? "" : "s"}</span>
              </div>
              <div className="song-pdf-zoom-controls" aria-label="Attachment zoom controls">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setZoomPercent((zoom) => Math.max(50, zoom - 25))}
                  disabled={zoomPercent <= 50}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <Minus size={17} />
                </button>
                <button
                  type="button"
                  className="song-pdf-zoom-reset"
                  onClick={() => setZoomPercent(100)}
                  aria-label="Reset zoom to 100 percent"
                  title="Reset zoom"
                >
                  {zoomPercent}%
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setZoomPercent((zoom) => Math.min(300, zoom + 25))}
                  disabled={zoomPercent >= 300}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <Plus size={17} />
                </button>
              </div>
              <label className={`secondary-button song-pdf-upload${uploading ? " disabled" : ""}`}>
                <input
                  className="guitar-hidden-file-input"
                  type="file"
                  accept="application/pdf,.pdf,image/png,.png"
                  multiple
                  disabled={uploading}
                  onChange={(event) => void uploadFiles(event)}
                />
                <Plus size={16} />
                {uploading ? "Uploading..." : "Add files"}
              </label>
              <button type="button" className="icon-button" onClick={() => setViewerOpen(false)} aria-label="Close file viewer">
                <X size={18} />
              </button>
            </header>

            {song.files.length > 2 ? (
              <div className="song-pdf-navigation">
                <div className="song-pdf-page-navigation">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPageStart((current) => Math.max(0, current - 2))}
                    disabled={pageStart === 0}
                    aria-label="Previous files"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span>{pageStart + 1}-{Math.min(pageStart + 2, song.files.length)} of {song.files.length}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPageStart((current) => Math.min(maxPageStart, current + 2))}
                    disabled={pageStart >= maxPageStart}
                    aria-label="Next files"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`song-pdf-pages${visibleFiles.length === 1 ? " single" : ""}`}>
              {visibleFiles.length ? visibleFiles.map((file) => (
                <article key={file.id} className="song-pdf-page">
                  <div className="song-pdf-file-header">
                    <span title={file.display_name}>{file.display_name}</span>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => void deleteFile(file.id)}
                      disabled={deletingFileId === file.id}
                      aria-label={`Delete file ${file.display_name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {file.display_name.toLowerCase().endsWith(".png") ? (
                    <div
                      className="song-pdf-image-viewport"
                      onWheel={(event) => {
                        if (!event.ctrlKey) return;
                        event.preventDefault();
                        setZoomPercent((zoom) => Math.max(50, Math.min(300, Math.round(zoom - event.deltaY * 0.15))));
                      }}
                    >
                      <div className="song-pdf-image-stage" style={{ width: `${zoomPercent}%`, height: `${zoomPercent}%` }}>
                        <img
                          className="song-pdf-image"
                          src={`${API_BASE}/api/guitar/song-files/${file.id}`}
                          alt={file.display_name}
                        />
                      </div>
                    </div>
                  ) : (
                    <SongPdfFrame
                      key={file.id}
                      fileId={file.id}
                      filename={file.display_name}
                      zoomPercent={zoomPercent}
                    />
                  )}
                </article>
              )) : (
                <div className="song-pdf-empty">
                  <FileText size={24} />
                  <span>No files uploaded</span>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function SongPdfFrame({
  fileId,
  filename,
  zoomPercent,
}: {
  fileId: number;
  filename: string;
  zoomPercent: number;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    let active = true;
    setPdfUrl(null);
    setError(null);

    fetch(`${API_BASE}/api/guitar/song-files/${fileId}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${filename}.`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        if (active) setPdfUrl(objectUrl);
      })
      .catch((caught: unknown) => {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setError(caught instanceof Error ? caught.message : "Could not load this PDF.");
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, filename]);

  if (error) return <div className="song-pdf-load-status" role="status">{error}</div>;
  if (!pdfUrl) return <div className="song-pdf-load-status" role="status">Loading preview...</div>;

  return (
    <iframe
      className="song-pdf-frame"
      src={`${pdfUrl}#zoom=${zoomPercent}`}
      title={filename}
    />
  );
}

function MajorBrowser() {
  const { cagedOnly, keyIdx, rootIndices, moveRoot, selectRoot, toggleCagedOnly } = useChordRootNavigation();
  const cfg = CHORD_TYPES[0]; // major
  const positions = getChordPositions(keyIdx, cfg.id);

  return (
    <div className="chord-browser">
      <div className="chord-browser-nav">
        <button className="icon-button chord-nav-btn" onClick={() => moveRoot(-1)} aria-label="Previous key">
          <ChevronLeft size={18} />
        </button>
        <ChordNameWithDegrees
          name={cfg.nameFn(KEY_LABELS[keyIdx])}
          intervals={cfg.intervals}
          tooltipId={`${cfg.id}-${keyIdx}-degrees`}
          className="chord-browser-label"
        />
        <button className="icon-button chord-nav-btn" onClick={() => moveRoot(1)} aria-label="Next key">
          <ChevronRight size={18} />
        </button>
      </div>
      <button type="button" className={`chord-caged-toggle${cagedOnly ? " active" : ""}`} onClick={toggleCagedOnly} aria-pressed={cagedOnly} title={cagedOnly ? "Show all keys" : "Show only C, A, G, E, and D"}>
        CAGED only
      </button>
      <div className="chord-browser-dots">
        {rootIndices.map((rootIdx, position) => (
          <button key={rootIdx} className={`chord-dot-btn${position === rootIndices.indexOf(keyIdx) ? " active" : ""}`} onClick={() => selectRoot(position)} aria-label={KEY_LABELS[rootIdx]} />
        ))}
      </div>
      <div className="chord-pos-row">
        {positions.map((p) => (
          <ChordDiagram key={`major-${keyIdx}-${p.shape}`} label={p.shape} defaultChord={p.frets} startFret={p.startFret} />
        ))}
      </div>
    </div>
  );
}

function MinorBrowser() {
  const { cagedOnly, keyIdx, rootIndices, moveRoot, selectRoot, toggleCagedOnly } = useChordRootNavigation();
  const cfg = CHORD_TYPES[1];
  const positions = getChordPositions(keyIdx, cfg.id);

  return (
    <div className="chord-browser">
      <div className="chord-browser-nav">
        <button className="icon-button chord-nav-btn" onClick={() => moveRoot(-1)} aria-label="Previous key">
          <ChevronLeft size={18} />
        </button>
        <ChordNameWithDegrees
          name={cfg.nameFn(KEY_LABELS[keyIdx])}
          intervals={cfg.intervals}
          tooltipId={`${cfg.id}-${keyIdx}-degrees`}
          className="chord-browser-label"
        />
        <button className="icon-button chord-nav-btn" onClick={() => moveRoot(1)} aria-label="Next key">
          <ChevronRight size={18} />
        </button>
      </div>
      <button type="button" className={`chord-caged-toggle${cagedOnly ? " active" : ""}`} onClick={toggleCagedOnly} aria-pressed={cagedOnly} title={cagedOnly ? "Show all keys" : "Show only C, A, G, E, and D"}>
        CAGED only
      </button>
      <div className="chord-browser-dots">
        {rootIndices.map((rootIdx, position) => (
          <button key={rootIdx} className={`chord-dot-btn${position === rootIndices.indexOf(keyIdx) ? " active" : ""}`} onClick={() => selectRoot(position)} aria-label={KEY_LABELS[rootIdx]} />
        ))}
      </div>
      <div className="chord-pos-row">
        {positions.map((p) => (
          <ChordDiagram key={`minor-${keyIdx}-${p.shape}`} label={p.shape} defaultChord={p.frets} startFret={p.startFret} />
        ))}
      </div>
    </div>
  );
}

function SeventhsBrowser() {
  const { cagedOnly, keyIdx, rootIndices, moveRoot, selectRoot, toggleCagedOnly } = useChordRootNavigation();
  const seventhTypes = CHORD_TYPES.slice(2);

  return (
    <div className="chord-browser chord-browser-sevenths">
      <div className="chord-browser-nav">
        <button className="icon-button chord-nav-btn" onClick={() => moveRoot(-1)} aria-label="Previous key">
          <ChevronLeft size={18} />
        </button>
        <span className="chord-browser-label">{KEY_LABELS[keyIdx]}</span>
        <button className="icon-button chord-nav-btn" onClick={() => moveRoot(1)} aria-label="Next key">
          <ChevronRight size={18} />
        </button>
      </div>
      <button type="button" className={`chord-caged-toggle${cagedOnly ? " active" : ""}`} onClick={toggleCagedOnly} aria-pressed={cagedOnly} title={cagedOnly ? "Show all keys" : "Show only C, A, G, E, and D"}>
        CAGED only
      </button>
      <div className="chord-browser-dots">
        {rootIndices.map((rootIdx, position) => (
          <button key={rootIdx} className={`chord-dot-btn${position === rootIndices.indexOf(keyIdx) ? " active" : ""}`} onClick={() => selectRoot(position)} aria-label={KEY_LABELS[rootIdx]} />
        ))}
      </div>
      {seventhTypes.map((cfg) => {
        const chordName = cfg.nameFn(KEY_LABELS[keyIdx]);
        const tooltipId = `${cfg.id}-${keyIdx}-intervals`;

        return (
          <div key={cfg.id} className="chord-sevenths-row">
            <ChordNameWithDegrees
              name={chordName}
              intervals={cfg.intervals}
              tooltipId={tooltipId}
              className="chord-row-type-label"
            />
            <div className="chord-pos-row">
              {getChordPositions(keyIdx, cfg.id).map((p) => (
                <ChordDiagram key={`${cfg.id}-${keyIdx}-${p.shape}`} label={p.shape} defaultChord={p.frets} startFret={p.startFret} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChordDiagram({
  label,
  defaultChord,
  startFret,
}: {
  label: string;
  defaultChord: readonly ChordValue[];
  startFret: number | null;
}) {
  const [chord, setChord] = useState<ChordValue[]>([...defaultChord]);
  const [hover, setHover] = useState<{ s: number; f: number } | null>(null);

  useEffect(() => {
    setChord([...defaultChord]);
  }, [defaultChord]);

  function handleFretClick(s: number, f: number) {
    const actualFret = firstVisibleFret + f - 1;
    setChord((prev) => {
      const next = [...prev] as ChordValue[];
      next[s] = next[s] === actualFret ? "o" : actualFret;
      return next;
    });
  }

  const STRING_WIDTHS = [2, 1.8, 1.5, 1.3, 1.1, 1];

  const fretboardTop = CD_NUT_Y;
  const fretboardBottom = cdFretLineY(CD_NUM_FRETS);
  const fretboardLeft = cdStringX(0);
  const fretboardRight = cdStringX(5);
  const isOpenPosition = chord.includes("o");
  const firstVisibleFret = startFret ?? 1;

  return (
    <div className="chord-diagram">
      <span className="chord-diagram-label">{label}</span>
      <div className="chord-diagram-board">
        <svg
          viewBox={`0 0 ${CD_W} ${CD_H}`}
          width={CD_W}
          height={CD_H}
          className="chord-diagram-svg"
          aria-label={`${label} chord diagram${startFret === null ? "" : ` starting at ${formatOrdinal(startFret)} fret`}`}
        >
        {/* Fretboard background */}
        <rect
          x={fretboardLeft} y={fretboardTop}
          width={fretboardRight - fretboardLeft}
          height={fretboardBottom - fretboardTop}
          fill="rgba(255,255,255,0.03)"
        />

        {/* Open shapes use a nut; movable shapes use a neutral starting line. */}
        {isOpenPosition ? (
          <line
            x1={fretboardLeft} y1={CD_NUT_Y}
            x2={fretboardRight} y2={CD_NUT_Y}
            style={{ stroke: "rgba(255,255,255,0.9)", strokeWidth: 5, strokeLinecap: "round" }}
          />
        ) : (
          <line
            x1={fretboardLeft} y1={CD_NUT_Y}
            x2={fretboardRight} y2={CD_NUT_Y}
            style={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1.5 }}
          />
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
            {firstVisibleFret + f}
          </text>
        ))}

        {/* Fret click zones + dots */}
        {Array.from({ length: 6 }, (_, s) =>
          Array.from({ length: CD_NUM_FRETS }, (_, fi) => {
            const fret = fi + 1;
            const actualFret = firstVisibleFret + fret - 1;
            const isActive = chord[s] === actualFret;
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
        {startFret !== null ? (
          <span className="chord-diagram-start-marker">{formatOrdinal(startFret)}</span>
        ) : null}
      </div>
    </div>
  );
}

function formatOrdinal(value: number) {
  const lastTwoDigits = value % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
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
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
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
