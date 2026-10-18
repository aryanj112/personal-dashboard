import { motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Copy, Flame, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Heatmap, WeeklyPieChart } from "../components/Charts";
import {
  ExerciseSessionDetails,
  GuitarSessionDetails,
  SESSION_BACKED_HABIT_NAMES,
} from "../components/HabitSessionDetails";
import { getCurrentWeekRangeLabel } from "../lib/dates";
import { formatDurationMinutes } from "../lib/duration";
import type { NetworkingContact } from "../lib/networking";
import type { DashboardResponse, ModuleResponse, TodayResponse } from "../lib/types";
import { api } from "../lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;
const panelTransition = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.34, ease: EASE },
};

export function DashboardPage({
  data,
  today,
  guitar,
  workouts,
  preferences,
  onNavigate,
  onRefresh,
}: {
  data: DashboardResponse;
  today: TodayResponse;
  guitar: ModuleResponse | null;
  workouts: ModuleResponse | null;
  preferences: {
    show_dashboard_refresh: boolean;
    show_open_today: boolean;
    show_export_today: boolean;
  };
  onNavigate: (route: "today") => void;
  onRefresh: () => Promise<void>;
}) {
  const fullText = "Welcome back, Aryan.";
  const [typedText, setTypedText] = useState("");
  const [selectedHeatmapHabit, setSelectedHeatmapHabit] = useState<string | null>(null);
  const [showGuitarDetails, setShowGuitarDetails] = useState(false);
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportText, setExportText] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const weekRangeLabel = getCurrentWeekRangeLabel();

  useEffect(() => {
    let index = 0;
    setTypedText("");
    const timer = window.setInterval(() => {
      index += 1;
      setTypedText(fullText.slice(0, index));
      if (index >= fullText.length) {
        window.clearInterval(timer);
      }
    }, 60);
    return () => window.clearInterval(timer);
  }, []);

  async function toggleHabit(habitId: number, completed: boolean) {
    await api.logHabit(habitId, !completed, today.date);
    await onRefresh();
  }

  async function toggleTask(taskId: number, completed: boolean) {
    await api.updateTask(taskId, { completed: !completed });
    await onRefresh();
  }

  async function openExportToday() {
    setShowExportModal(true);
    setExportLoading(true);
    setCopyState("idle");
    try {
      const [todayData, dashboardData, guitarData, workoutData, networkingData] = await Promise.all([
        api.getToday(),
        api.getDashboard(),
        api.getGuitar(),
        api.getWorkouts(),
        api.getNetworking(),
      ]);
      setExportText(
        buildTodayExport({
          today: todayData,
          dashboard: dashboardData,
          guitar: guitarData,
          workouts: workoutData,
          networking: networkingData.contacts,
        }),
      );
    } finally {
      setExportLoading(false);
    }
  }

  async function copyExportText() {
    if (!exportText) {
      return;
    }
    await navigator.clipboard.writeText(exportText);
    setCopyState("copied");
  }

  const todayGuitarSessions = (guitar?.sessions ?? []).filter(
    (session) => session.session_date === today.date,
  );
  const todayWorkoutSessions = (workouts?.sessions ?? []).filter(
    (session) => session.session_date === today.date,
  );
  const completedCount =
    today.habits.filter((habit) => habit.completed).length +
    today.tasks.filter((task) => task.completed).length;
  const totalCount = today.habits.length + today.tasks.length;
  const focusItems = [
    ...today.habits.map((habit) => ({
      key: `habit-${habit.id}`,
      type: "habit" as const,
      label: habit.name,
      completed: Boolean(habit.completed),
      habitId: habit.id,
      isSessionBacked: SESSION_BACKED_HABIT_NAMES.has(habit.name),
    })),
    ...today.tasks.map((task) => ({
      key: `task-${task.id}`,
      type: "task" as const,
      label: task.text,
      completed: task.completed,
      taskId: task.id,
    })),
  ].sort((a, b) => Number(a.completed) - Number(b.completed));
  const heatmapHabits = useMemo(() => {
    const names = new Set(today.habits.map((habit) => habit.name));
    data.habit_heatmap.forEach((cell) => {
      cell.habits.forEach((habit) => names.add(habit));
      cell.sick_habits?.forEach((habit) => names.add(habit));
    });
    return Array.from(names);
  }, [data.habit_heatmap, today.habits]);
  const heatmapCells = useMemo(() => {
    if (selectedHeatmapHabit === null) {
      return data.habit_heatmap;
    }

    return data.habit_heatmap.map((cell) => {
      const completed = cell.habits.includes(selectedHeatmapHabit);
      const sick = cell.sick_habits?.includes(selectedHeatmapHabit) ?? false;
      return {
        ...cell,
        count: completed ? 1 : 0,
        habits: completed ? [selectedHeatmapHabit] : [],
        sick_habits: sick ? [selectedHeatmapHabit] : [],
        total_habits: 1,
      };
    });
  }, [data.habit_heatmap, selectedHeatmapHabit]);
  const heatmapTotalHabits = selectedHeatmapHabit === null ? data.today.total_habits : 1;

  return (
    <section className="page dashboard-page">
      <motion.div className="page-heading dashboard-heading" {...panelTransition}>
        <div>
          <h2 className="hero-title">
            {typedText}
            <span className="typewriter-caret" />
          </h2>
        </div>

        <div className="hero-actions">
          {preferences.show_dashboard_refresh ? (
            <button className="secondary-button" onClick={() => void onRefresh()}>
              <RefreshCw size={16} />
              Refresh
            </button>
          ) : null}
          {preferences.show_open_today ? (
            <button
              className={preferences.show_export_today ? "secondary-button" : "primary-button"}
              onClick={() => onNavigate("today")}
            >
              Open today
              <ArrowUpRight size={16} />
            </button>
          ) : null}
          {preferences.show_export_today ? (
            <button className="primary-button" onClick={() => void openExportToday()}>
              Export today
              <ArrowUpRight size={16} />
            </button>
          ) : null}
        </div>
      </motion.div>

      <div className="content-grid dashboard-main-grid">
        <motion.section className="surface-card focus-panel" {...panelTransition}>
          <div className="surface-header">
            <div>
              <h3>Tasks</h3>
            </div>
            <span>{completedCount}/{totalCount}</span>
          </div>

          <div className="focus-list">
            {focusItems.map((item) => {
              if (item.type === "task") {
                return (
                  <div key={item.key} className="list-row task-row">
                    <button
                      className={`check-circle ${item.completed ? "checked" : ""}`}
                      onClick={() => void toggleTask(item.taskId, item.completed)}
                    >
                      {item.completed ? "✓" : ""}
                    </button>
                    <button
                      className="row-label"
                      onClick={() => void toggleTask(item.taskId, item.completed)}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              }

              const isGuitar = item.label === "Guitar";
              const isExercise = item.label === "Exercise";
              const isOpen = isGuitar ? showGuitarDetails : isExercise ? showExerciseDetails : false;

              return (
                <div key={item.key} className="entry-stack">
                  <div className="list-row task-row">
                    <button
                      className={`check-circle ${item.completed ? "checked" : ""}`}
                      onClick={() => {
                        if (item.isSessionBacked) {
                          if (isGuitar) {
                            setShowGuitarDetails(true);
                          }
                          if (isExercise) {
                            setShowExerciseDetails(true);
                          }
                          return;
                        }
                        void toggleHabit(item.habitId, item.completed);
                      }}
                    >
                      {item.completed ? "✓" : ""}
                    </button>
                    <button
                      className="row-label"
                      onClick={() => {
                        if (item.isSessionBacked) {
                          if (isGuitar) {
                            setShowGuitarDetails(true);
                          }
                          if (isExercise) {
                            setShowExerciseDetails(true);
                          }
                          return;
                        }
                        void toggleHabit(item.habitId, item.completed);
                      }}
                    >
                      {item.label}
                    </button>
                    {item.isSessionBacked ? (
                      <button
                        className={`icon-toggle ${isOpen ? "open" : ""}`}
                        onClick={() => {
                          if (isGuitar) {
                            setShowGuitarDetails((current) => !current);
                          }
                          if (isExercise) {
                            setShowExerciseDetails((current) => !current);
                          }
                        }}
                        aria-label={`Toggle ${item.label}`}
                      >
                        <ChevronDown size={16} />
                      </button>
                    ) : null}
                  </div>

                  {isGuitar && showGuitarDetails ? (
                    <GuitarSessionDetails
                      date={today.date}
                      guitar={guitar}
                      sessions={todayGuitarSessions}
                      onRefresh={onRefresh}
                      onSessionCreated={() => setShowGuitarDetails(false)}
                    />
                  ) : null}

                  {isExercise && showExerciseDetails ? (
                    <ExerciseSessionDetails
                      date={today.date}
                      workouts={workouts}
                      sessions={todayWorkoutSessions}
                      onRefresh={onRefresh}
                      onSessionCreated={() => setShowExerciseDetails(false)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section className="surface-card" {...panelTransition}>
          <div className="surface-header">
            <div>
              <h3>Habit heatmap</h3>
            </div>
          </div>
          <div className="chip-grid heatmap-filter-row">
            {heatmapHabits.map((habitName) => (
              <button
                key={habitName}
                type="button"
                className={`chip ${selectedHeatmapHabit === habitName ? "active" : ""}`}
                onClick={() =>
                  setSelectedHeatmapHabit((current) => (current === habitName ? null : habitName))
                }
              >
                {habitName}
              </button>
            ))}
          </div>
          <Heatmap
            cells={heatmapCells}
            totalHabits={heatmapTotalHabits}
            variant={selectedHeatmapHabit === null ? "aggregate" : "binary"}
          />
        </motion.section>
      </div>

      <motion.section className="surface-card streak-band" {...panelTransition}>
        <div className="surface-header">
          <div>
            <h3>Streaks</h3>
          </div>
          <Flame size={16} />
        </div>
        <div className="streaks-strip">
          {data.streaks.map((item) => (
            <div key={item.habit_id} className={`streak-chip ${item.streak === 0 && item.last_completed_date ? "streak-chip-overdue" : ""}`}>
              <strong>{item.streak > 0 ? item.streak : formatTimeSinceLastDone(item.last_completed_date)}</strong>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="content-grid analytics-grid">
        <motion.section className="surface-card" {...panelTransition}>
          <div className="surface-header">
            <div>
              <h3>Guitar breakdown</h3>
              <p>{weekRangeLabel}</p>
            </div>
          </div>
          <WeeklyPieChart
            items={data.guitar.section_distribution}
            totalValue={data.guitar.days_this_week}
            totalLabel="days"
            emptyLabel={`Nothing logged for ${weekRangeLabel} yet`}
            totalFormatter={(value) => `${value}/7`}
          />
        </motion.section>

        <motion.section className="surface-card" {...panelTransition}>
          <div className="surface-header">
            <div>
              <h3>Workout breakdown</h3>
              <p>{weekRangeLabel}</p>
            </div>
          </div>
          <WeeklyPieChart
            items={data.workouts.section_distribution}
            totalValue={data.workouts.days_this_week}
            totalLabel="days"
            emptyLabel={`Nothing logged for ${weekRangeLabel} yet`}
            totalFormatter={(value) => `${value}/7`}
          />
        </motion.section>

      </div>

      {showExportModal ? (
        <div className="networking-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div
            className="surface-card networking-modal export-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="surface-header networking-modal-header">
              <div>
                <h3>Export today</h3>
              </div>
              <button
                className="icon-button networking-modal-close"
                type="button"
                aria-label="Close export"
                onClick={() => setShowExportModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="export-modal-body">
              {exportLoading ? (
                <div className="empty-state">
                  <h4>Building your update.</h4>
                  <p>Pulling today&apos;s habits, sessions, networking, and streaks into one summary.</p>
                </div>
              ) : (
                <>
                  <textarea className="export-preview" value={exportText} readOnly rows={18} />
                  <div className="export-actions">
                    <button className="secondary-button" type="button" onClick={() => setShowExportModal(false)}>
                      Close
                    </button>
                    <button className="primary-button" type="button" onClick={() => void copyExportText()}>
                      <Copy size={16} />
                      {copyState === "copied" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildTodayExport({
  today,
  dashboard,
  guitar,
  workouts,
  networking,
}: {
  today: TodayResponse;
  dashboard: DashboardResponse;
  guitar: ModuleResponse;
  workouts: ModuleResponse;
  networking: NetworkingContact[];
}) {
  const generatedAt = new Date();
  const completedHabits = today.habits.filter((habit) => habit.completed);
  const missedHabits = today.habits.filter((habit) => !habit.completed);
  const completedTasks = today.tasks.filter((task) => task.completed);
  const openTasks = today.tasks.filter((task) => !task.completed);
  const todayGuitarSessions = guitar.sessions.filter((session) => session.session_date === today.date);
  const todayWorkoutSessions = workouts.sessions.filter((session) => session.session_date === today.date);
  const addedContacts = networking.filter(
    (contact) => new Date(contact.createdAt).toLocaleDateString("en-CA") === today.date,
  );
  const activeChecklists = today.checklists.filter((checklist) => checklist.today_count > 0);
  const activeStreaks = dashboard.streaks.filter((item) => item.streak > 0).sort((a, b) => b.streak - a.streak);

  const lines = [
    `✨ Aryan's update for ${formatLongDate(today.date)} (${generatedAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })})`,
    "",
    "✅ Done today",
    `- 🪴 Habits: ${completedHabits.length}/${today.habits.length}${completedHabits.length ? ` — ${completedHabits.map((habit) => habit.name).join(", ")}` : ""}`,
    `- 🎸 Guitar: ${describeSessions(todayGuitarSessions, "guitar")}`,
    `- 💪 Physical exercise: ${describeSessions(todayWorkoutSessions, "workout")}`,
  ];

  if (completedTasks.length > 0) {
    lines.push(`- ✅ Tasks finished: ${completedTasks.map((task) => task.text).join(", ")}`);
  }

  if (activeChecklists.length > 0) {
    lines.push(
      `- 📋 Checklists: ${activeChecklists
        .map(
          (checklist) =>
            `${checklist.text} +${checklist.today_count} today (${checklist.current_count}/${checklist.total_goal})`,
        )
        .join("; ")}`,
    );
  }

  if (addedContacts.length > 0) {
    lines.push(
      `- 🤝 Networking: added ${addedContacts.length} ${addedContacts.length === 1 ? "person" : "people"} — ${addedContacts
        .map((contact) => `${contact.name}${contact.company ? ` @ ${contact.company}` : ""}`)
        .join(", ")}`,
    );
  }

  lines.push("", "📝 Still open");
  lines.push(
    `- 🌙 Habits left: ${missedHabits.length ? missedHabits.map((habit) => habit.name).join(", ") : "nothing"}`,
  );
  lines.push(`- ⏳ Tasks left: ${openTasks.length ? openTasks.map((task) => task.text).join(", ") : "nothing"}`);

  if (activeStreaks.length > 0) {
    lines.push("", "🔥 Streaks");
    activeStreaks.forEach((item) => {
      lines.push(`- ${item.name}: ${item.streak}${getStreakFlair(item.streak)}`);
    });
  }

  return lines.join("\n");
}

function formatLongDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function describeSessions(sessions: ModuleResponse["sessions"], kind: "guitar" | "workout") {
  if (sessions.length === 0) {
    return "not logged yet";
  }

  if (sessions.length === 1) {
    return describeSession(sessions[0], kind);
  }

  return `${sessions.length} sessions — ${sessions.map((session) => describeSession(session, kind)).join("; ")}`;
}

function describeSession(session: ModuleResponse["sessions"][number], kind: "guitar" | "workout") {
  const sectionLabel = session.sections.map((section) => section.name).join(", ") || "No type";
  if (kind === "workout" && session.run_miles != null) {
    return `${sectionLabel} (${session.run_miles} mi in ${formatDurationMinutes(session.duration_minutes)})`;
  }
  return sectionLabel;
}

function getStreakFlair(streak: number) {
  if (streak >= 21) return " 🔥🔥🔥";
  if (streak >= 14) return " 🔥🔥";
  if (streak >= 7) return " 🔥";
  return "";
}

function formatTimeSinceLastDone(value?: string | null) {
  if (!value) {
    return "Never";
  }

  const today = new Date();
  const lastDone = new Date(`${value}T12:00:00`);
  const todayAtNoon = new Date(today.toLocaleDateString("en-CA") + "T12:00:00");
  const diffMs = todayAtNoon.getTime() - lastDone.getTime();
  const days = Math.max(0, Math.round(diffMs / 86400000));

  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "1d ago";
  }
  return `${days}d ago`;
}
