import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  DEFAULT_RUN_DURATION_MINUTES,
  formatDurationInput,
  parseDurationInput,
} from "../lib/duration";
import type { ModuleResponse } from "../lib/types";

export const SESSION_BACKED_HABIT_NAMES = new Set(["Guitar", "Exercise"]);

export function GuitarSessionDetails({
  date,
  guitar,
  sessions,
  onRefresh,
  onSessionCreated,
}: {
  date: string;
  guitar: ModuleResponse | null;
  sessions: ModuleResponse["sessions"];
  onRefresh: () => Promise<void>;
  onSessionCreated?: () => void;
}) {
  const sections = guitar?.sections ?? [];

  return (
    <div className="detail-panel">
      <GuitarSessionEditor
        date={date}
        sections={sections}
        onRefresh={onRefresh}
        onSessionCreated={onSessionCreated}
      />
      {sessions.length > 0 ? (
        <div className="editor-list">
          {sessions.map((session) => (
            <GuitarSessionEditor
              key={session.id}
              session={session}
              date={date}
              sections={sections}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ExerciseSessionDetails({
  date,
  workouts,
  sessions,
  onRefresh,
  onSessionCreated,
}: {
  date: string;
  workouts: ModuleResponse | null;
  sessions: ModuleResponse["sessions"];
  onRefresh: () => Promise<void>;
  onSessionCreated?: () => void;
}) {
  const sections = workouts?.sections ?? [];
  const defaultRunDuration = getLastRunDuration(workouts?.sessions ?? []);
  const workoutSessions = sessions.filter((s) => !s.is_rest);
  const restDaySessions = sessions.filter((s) => s.is_rest);

  return (
    <div className="detail-panel">
      <ExerciseSessionEditor
        date={date}
        sections={sections}
        defaultRunDuration={defaultRunDuration}
        onRefresh={onRefresh}
        onSessionCreated={onSessionCreated}
      />
      {workoutSessions.length > 0 ? (
        <div className="editor-list">
          {workoutSessions.map((session) => (
            <ExerciseSessionEditor
              key={session.id}
              session={session}
              date={date}
              sections={sections}
              defaultRunDuration={defaultRunDuration}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : null}
      {restDaySessions.length > 0 ? (
        <div className="editor-list">
          <div className="session-subheading">Rest days</div>
          {restDaySessions.map((session) => (
            <ExerciseSessionEditor
              key={session.id}
              session={session}
              date={date}
              sections={sections}
              defaultRunDuration={defaultRunDuration}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GuitarSessionEditor({
  date,
  sections,
  session,
  onRefresh,
  onSessionCreated,
}: {
  date: string;
  sections: ModuleResponse["sections"];
  session?: ModuleResponse["sessions"][number];
  onRefresh: () => Promise<void>;
  onSessionCreated?: () => void;
}) {
  const initialForm = useMemo(
    () => ({
      section_ids: session?.sections.map((section) => section.id) ?? [],
    }),
    [session],
  );
  const [form, setForm] = useState(initialForm);
  const resetForm = useCallback(() => setForm(initialForm), [initialForm]);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const draftRef = useDiscardDraft({
    enabled: !session,
    dirty: form.section_ids.length > 0,
    onDiscard: resetForm,
  });

  async function save() {
    const payload = {
      date,
      section_ids: form.section_ids,
      duration_minutes: 0,
      notes: "",
    };
    if (session) {
      await api.updateSession("guitar", session.id, payload);
    } else {
      await api.createSession("guitar", payload);
      resetForm();
    }
    await onRefresh();
    if (!session) {
      onSessionCreated?.();
    }
  }

  return (
    <div ref={draftRef} className="detail-editor">
      <div className="chip-grid">
        {sections.map((section) => {
          const active = form.section_ids.includes(section.id);
          return (
            <button
              key={section.id}
              type="button"
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
      <div className="editor-actions">
        <button className="primary-button" type="button" onClick={() => void save()}>
          {session ? "Save" : "Add session"}
        </button>
        {session ? (
          <button
            className="icon-button danger"
            type="button"
            onClick={async () => {
              await api.deleteSession("guitar", session.id);
              await onRefresh();
            }}
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ExerciseSessionEditor({
  date,
  sections,
  session,
  defaultRunDuration,
  onRefresh,
  onSessionCreated,
}: {
  date: string;
  sections: ModuleResponse["sections"];
  session?: ModuleResponse["sessions"][number];
  defaultRunDuration: number;
  onRefresh: () => Promise<void>;
  onSessionCreated?: () => void;
}) {
  const sessionStartsAsRun = session?.sections.some((section) => section.name === "Run") ?? false;
  const initialForm = useMemo(
    () => ({
      section_ids: session?.sections.map((section) => section.id) ?? [],
      run_miles: session?.run_miles ?? null,
      duration_minutes: session?.duration_minutes ?? 30,
      run_duration_input: sessionStartsAsRun
        ? formatDurationInput(session?.duration_minutes ?? defaultRunDuration)
        : formatDurationInput(defaultRunDuration),
      notes: session?.notes ?? "",
      is_rest: session?.is_rest ?? false,
    }),
    [defaultRunDuration, session, sessionStartsAsRun],
  );
  const [form, setForm] = useState(initialForm);
  const resetForm = useCallback(() => setForm(initialForm), [initialForm]);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const isRun = !form.is_rest && form.section_ids.some(
    (sectionId) => sections.find((section) => section.id === sectionId)?.name === "Run",
  );

  const draftRef = useDiscardDraft({
    enabled: !session,
    dirty:
      form.is_rest ||
      form.section_ids.length > 0 ||
      form.notes.trim().length > 0 ||
      form.run_miles !== null ||
      (isRun && parseDurationInput(form.run_duration_input, defaultRunDuration) !== defaultRunDuration),
    onDiscard: resetForm,
  });

  async function save() {
    const payload = {
      date,
      section_ids: form.is_rest ? [] : form.section_ids,
      run_miles: isRun ? form.run_miles : null,
      duration_minutes: form.is_rest ? 0 : isRun
        ? parseDurationInput(form.run_duration_input, defaultRunDuration)
        : form.duration_minutes,
      notes: form.notes,
      is_rest: form.is_rest,
    };
    if (session) {
      await api.updateSession("workouts", session.id, payload);
    } else {
      await api.createSession("workouts", payload);
      resetForm();
    }
    await onRefresh();
    if (!session) {
      onSessionCreated?.();
    }
  }

  return (
    <div ref={draftRef} className="detail-editor">
      {!form.is_rest ? (
        <div className="chip-grid">
          {sections.map((section) => {
            const active = form.section_ids.includes(section.id);
            return (
              <button
                key={section.id}
                type="button"
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
      ) : null}
      <div className="rest-day-row">
        <button
          type="button"
          className={`chip rest-day-chip ${form.is_rest ? "active" : ""}`}
          onClick={() =>
            setForm((current) => ({
              ...current,
              is_rest: !current.is_rest,
              section_ids: current.is_rest ? current.section_ids : [],
            }))
          }
        >
          Rest Day
        </button>
      </div>
      {isRun ? (
        <div className="field-row">
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.run_miles ?? ""}
            placeholder="Miles"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                run_miles: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
          <input
            type="text"
            inputMode="numeric"
            value={form.run_duration_input}
            placeholder="8:15"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                run_duration_input: event.target.value,
              }))
            }
            onBlur={() =>
              setForm((current) => ({
                ...current,
                run_duration_input: formatDurationInput(
                  parseDurationInput(current.run_duration_input, defaultRunDuration),
                ),
              }))
            }
          />
        </div>
      ) : null}
      <textarea
        className="field-textarea"
        rows={3}
        value={form.notes}
        placeholder="Notes"
        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
      />
      <div className="editor-actions">
        <button className="primary-button" type="button" onClick={() => void save()}>
          {session ? "Save" : "Add session"}
        </button>
        {session ? (
          <button
            className="icon-button danger"
            type="button"
            onClick={async () => {
              await api.deleteSession("workouts", session.id);
              await onRefresh();
            }}
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getLastRunDuration(sessions: ModuleResponse["sessions"]) {
  const lastRun = [...sessions]
    .filter((session) => session.sections.some((section) => section.name === "Run"))
    .sort(
      (left, right) =>
        right.session_date.localeCompare(left.session_date) || right.id - left.id,
    )[0];

  return lastRun?.duration_minutes ?? DEFAULT_RUN_DURATION_MINUTES;
}

function useDiscardDraft({
  enabled,
  dirty,
  onDiscard,
}: {
  enabled: boolean;
  dirty: boolean;
  onDiscard: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !dirty) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const node = ref.current;
      if (!node || node.contains(event.target as Node)) {
        return;
      }
      onDiscard();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [dirty, enabled, onDiscard]);

  return ref;
}
