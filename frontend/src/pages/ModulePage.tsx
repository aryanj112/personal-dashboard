import { motion } from "framer-motion";
import { ChevronDown, Plus, Thermometer, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { WeeklyPieChart } from "../components/Charts";
import { WorkoutHistoryCard } from "../components/WorkoutHistoryCard";
import { api } from "../lib/api";
import { getCurrentWeekBounds, getCurrentWeekRangeLabel } from "../lib/dates";
import {
  DEFAULT_RUN_DURATION_MINUTES,
  formatDurationInput,
  formatDurationMinutes,
  parseDurationInput,
} from "../lib/duration";
import type { ModuleResponse } from "../lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const panelReveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

export function ModulePage({
  title,
  kind,
  data,
  onRefresh,
}: {
  title: string;
  kind: "guitar" | "workouts";
  data: ModuleResponse;
  onRefresh: () => Promise<void>;
}) {
  const todayString = getTodayString();
  const defaultRunDuration = getLastRunDuration(data.sessions);
  const [form, setForm] = useState({
    date: todayString,
    duration_minutes: kind === "workouts" ? 30 : 0,
    run_duration_input: formatDurationInput(defaultRunDuration),
    run_miles: null as number | null,
    section_ids: [] as number[],
    is_rest: false,
  });

  const selectedSection = data.sections.find((section) => form.section_ids.includes(section.id));
  const isRun = kind === "workouts" && !form.is_rest && selectedSection?.name === "Run";
  const isSickDate = kind === "workouts" && Boolean(data.sick_dates?.includes(form.date));
  const [showWeekSessions, setShowWeekSessions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const weekRangeLabel = getCurrentWeekRangeLabel();
  const weekBounds = getCurrentWeekBounds();
  const thisWeekSessions = data.sessions.filter(
    (session) =>
      session.session_date >= weekBounds.startIso && session.session_date <= weekBounds.endIso,
  );
  const thisWeekWorkouts = thisWeekSessions.filter((s) => !s.is_rest);
  const thisWeekRestDays = thisWeekSessions.filter((s) => s.is_rest);
  const allWorkoutSessions = data.sessions.filter((s) => !s.is_rest);
  const allRestDaySessions = data.sessions.filter((s) => s.is_rest);

  async function submitSession(event: FormEvent) {
    event.preventDefault();
    if (isSickDate) return;
    const runDuration = parseDurationInput(form.run_duration_input, defaultRunDuration);
    await api.createSession(kind, {
      date: form.date,
      section_ids: form.is_rest ? [] : form.section_ids,
      is_rest: form.is_rest,
      duration_minutes:
        kind === "guitar"
          ? 0
          : form.is_rest
            ? 0
            : isRun
              ? runDuration
              : form.duration_minutes,
      run_miles: isRun ? form.run_miles : null,
    });
    setForm({
      date: todayString,
      duration_minutes: kind === "workouts" ? 30 : 0,
      run_duration_input: formatDurationInput(isRun ? runDuration : defaultRunDuration),
      run_miles: null,
      section_ids: [],
      is_rest: false,
    });
    await onRefresh();
  }

  return (
    <section className="page module-page">
      <motion.div className="page-heading" {...panelReveal}>
        <div>
          <h2 className="hero-title">{title}</h2>
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

            <div className="field-group">
              {kind !== "guitar" && (
                <span className="field-caption">Workout types</span>
              )}
              {!form.is_rest ? (
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
              ) : null}
              {kind === "workouts" ? (
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
                  {kind === "workouts" ? (
                    <button
                      type="button"
                      className={`chip rest-day-chip sick-day-chip${isSickDate ? " active" : ""}`}
                      aria-pressed={isSickDate}
                      onClick={async () => {
                        await api.setSickDay(!isSickDate, form.date);
                        await onRefresh();
                      }}
                    >
                      <Thermometer size={14} />
                      Sick Day
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {kind === "workouts" && isRun ? (
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

            {isSickDate ? (
              <p className="sick-day-notice" role="status">Sick day marked for this date.</p>
            ) : (
              <button type="submit" className="primary-button">
                <Plus size={16} />
                Save session
              </button>
            )}
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
            {thisWeekWorkouts.map((session) => (
              <div key={session.id} className="session-card">
                <div>
                  <strong>{formatSessionDate(session.session_date)}</strong>
                  <p>
                    {session.sections.map((section) => section.name).join(", ") || "No type"}
                    {kind === "workouts" && session.run_miles != null
                      ? ` · ${session.run_miles} mi in ${formatDurationMinutes(session.duration_minutes)}`
                      : ""}
                  </p>
                </div>
              </div>
            ))}
            {thisWeekWorkouts.length === 0 ? (
              <div className="empty-state">
                <h4>No sessions for {weekRangeLabel}.</h4>
              </div>
            ) : null}
            {kind === "workouts" && thisWeekRestDays.length > 0 ? (
              <>
                <div className="session-subheading">Rest days</div>
                {thisWeekRestDays.map((session) => (
                  <div key={session.id} className="session-card session-card-rest">
                    <div>
                      <strong>{formatSessionDate(session.session_date)}</strong>
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </motion.section>

      <motion.section className="surface-card" {...panelReveal}>
        <button
          type="button"
          className="surface-toggle"
          onClick={() => setShowHistory((current) => !current)}
        >
          <div>
            <h3>History</h3>
            <p className="eyebrow">{kind === "workouts" ? allWorkoutSessions.length : data.sessions.length} sessions</p>
          </div>
          <ChevronDown className={showHistory ? "open" : ""} size={18} />
        </button>

        {showHistory ? (
          <div className="toggle-panel session-list">
            {kind === "workouts" ? (
              <>
                {allWorkoutSessions.map((session) => (
                  <WorkoutHistoryCard
                    key={session.id}
                    session={session}
                    sections={data.sections}
                    onRefresh={onRefresh}
                  />
                ))}
                {allWorkoutSessions.length === 0 ? (
                  <div className="empty-state">
                    <h4>No sessions yet.</h4>
                  </div>
                ) : null}
                {allRestDaySessions.length > 0 ? (
                  <>
                    <div className="session-subheading">Rest days</div>
                    {allRestDaySessions.map((session) => (
                      <WorkoutHistoryCard
                        key={session.id}
                        session={session}
                        sections={data.sections}
                        onRefresh={onRefresh}
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <>
                {data.sessions.map((session) => (
                  <div key={session.id} className="session-card">
                    <div>
                      <strong>{formatSessionDate(session.session_date)}</strong>
                      <p>
                        {session.sections.map((section) => section.name).join(", ") || "No type"}
                        {session.run_miles != null
                          ? ` · ${session.run_miles} mi in ${formatDurationMinutes(session.duration_minutes)}`
                          : ""}
                      </p>
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
                ))}
                {data.sessions.length === 0 ? (
                  <div className="empty-state">
                    <h4>No sessions yet.</h4>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </motion.section>
    </section>
  );
}

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

function formatSessionDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
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
