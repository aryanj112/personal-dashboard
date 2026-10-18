import { Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  DEFAULT_RUN_DURATION_MINUTES,
  formatDurationInput,
  formatDurationMinutes,
  parseDurationInput,
} from "../lib/duration";
import type { ModuleResponse } from "../lib/types";

export function WorkoutHistoryCard({
  session,
  sections,
  onRefresh,
}: {
  session: ModuleResponse["sessions"][number];
  sections: ModuleResponse["sections"];
  onRefresh: () => Promise<void>;
}) {
  const defaultRunDuration = getLastRunDurationFromSections(sections, session.duration_minutes);
  const sessionStartsAsRun = session.sections.some((section) => section.name === "Run");
  const initialForm = useMemo(
    () => ({
      date: session.session_date,
      section_ids: session.sections.map((section) => section.id),
      run_miles: session.run_miles ?? null,
      duration_minutes: session.duration_minutes,
      run_duration_input: sessionStartsAsRun
        ? formatDurationInput(session.duration_minutes)
        : formatDurationInput(defaultRunDuration),
      is_rest: session.is_rest ?? false,
    }),
    [defaultRunDuration, session, sessionStartsAsRun],
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const isRun = !form.is_rest && form.section_ids.some(
    (sectionId) => sections.find((section) => section.id === sectionId)?.name === "Run",
  );

  async function save() {
    await api.updateSession("workouts", session.id, {
      date: form.date,
      section_ids: form.is_rest ? [] : form.section_ids,
      run_miles: isRun ? form.run_miles : null,
      duration_minutes: form.is_rest
        ? 0
        : isRun
          ? parseDurationInput(form.run_duration_input, defaultRunDuration)
          : form.duration_minutes,
      is_rest: form.is_rest,
    });
    setEditing(false);
    await onRefresh();
  }

  async function remove() {
    await api.deleteSession("workouts", session.id);
    await onRefresh();
  }

  if (editing) {
    return (
      <div className="session-card session-card-editor">
        <label>
          <span>Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
          />
        </label>

        <div className="field-group">
          <span className="field-caption">Workout types</span>
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
        </div>

        {isRun ? (
          <div className="field-row">
            <label>
              <span>Miles</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.run_miles ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    run_miles: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </label>
            <label>
              <span>Time</span>
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
            </label>
          </div>
        ) : null}

        <div className="editor-actions">
          <button className="secondary-button" type="button" onClick={() => setEditing(false)}>
            <X size={16} />
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void save()}>
            Save changes
          </button>
          <button className="icon-button danger" type="button" onClick={() => void remove()}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-card">
      <div>
        <strong>{formatSessionDate(session.session_date)}</strong>
        <p>
          {session.is_rest
            ? "Rest Day"
            : session.sections.map((section) => section.name).join(", ") || "No type"}
          {!session.is_rest && session.run_miles != null
            ? ` · ${session.run_miles} mi in ${formatDurationMinutes(session.duration_minutes)}`
            : ""}
        </p>
      </div>
      <div className="session-card-actions">
        <button className="icon-button" type="button" onClick={() => setEditing(true)} aria-label="Edit workout">
          <Pencil size={16} />
        </button>
        <button className="icon-button danger" type="button" onClick={() => void remove()} aria-label="Delete workout">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function formatSessionDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function getLastRunDurationFromSections(
  sections: ModuleResponse["sections"],
  fallbackDuration: number,
) {
  return sections.some((section) => section.name === "Run")
    ? fallbackDuration || DEFAULT_RUN_DURATION_MINUTES
    : DEFAULT_RUN_DURATION_MINUTES;
}
