import { motion } from "framer-motion";
import {
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  MoreHorizontal,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ExerciseSessionDetails,
  GuitarSessionDetails,
  SESSION_BACKED_HABIT_NAMES,
} from "../components/HabitSessionDetails";
import { api } from "../lib/api";
import type {
  ModuleResponse,
  Task,
  TaskPriority,
  TodayResponse,
  WeekResponse,
} from "../lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

// Priority a task falls back to when none is chosen, and when a dated task is
// moved to misc (an "eventually" item keeps no urgency from its old date).
const DEFAULT_TASK_PRIORITY: TaskPriority = "medium";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(value: string, amount: number) {
  const next = new Date(`${value}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toLocaleDateString("en-CA");
}

function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-CA");
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(start: string, end: string): string {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const sm = s.toLocaleDateString(undefined, { month: "short" });
  const em = e.toLocaleDateString(undefined, { month: "short" });
  const sd = s.getDate();
  const ed = e.getDate();
  const yr = e.getFullYear();
  if (sm === em) return `${sm} ${sd}–${ed}, ${yr}`;
  return `${sm} ${sd} – ${em} ${ed}, ${yr}`;
}

// Legacy localStorage key — migrated to DB on first load
const NOTES_LEGACY_KEY = "personal-quick-notes";

function handleTodayNotesKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Tab") {
    event.preventDefault();
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
    textarea.value = nextValue;
    textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (event.key !== "Enter") return;

  const textarea = event.currentTarget;
  const { selectionStart, selectionEnd, value } = textarea;
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const line = value.slice(lineStart, selectionStart);
  const bulletMatch = line.match(/^(\s*)([-*] |\[\] |\d+\. )/);

  if (!bulletMatch) return;

  event.preventDefault();
  const prefix = bulletMatch[1] + bulletMatch[2];
  const nextValue = `${value.slice(0, selectionStart)}\n${prefix}${value.slice(selectionEnd)}`;
  const nextCursor = selectionStart + prefix.length + 1;
  textarea.value = nextValue;
  textarea.setSelectionRange(nextCursor, nextCursor);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

// ─── Day-of-week labels (used in modal + recurring panel) ────────────────────

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

// ─── Add Task Modal ──────────────────────────────────────────────────────────

type DateMode = "today" | "pick" | "misc" | "recurring";

function AddTaskModal({
  defaultDate,
  defaultMisc = false,
  defaultRecurring = false,
  onClose,
  onSubmit,
  onSubmitRecurring,
}: {
  defaultDate: string;
  defaultMisc?: boolean;
  defaultRecurring?: boolean;
  onClose: () => void;
  onSubmit: (text: string, priority: TaskPriority, date: string | null, is_misc: boolean, url: string) => Promise<void>;
  onSubmitRecurring?: (text: string, priority: TaskPriority, days_of_week: number[], end_date: string | null) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [dateMode, setDateMode] = useState<DateMode>(() => {
    if (defaultRecurring) return "recurring";
    if (defaultMisc) return "misc";
    return defaultDate === getTodayString() ? "today" : "pick";
  });
  const [pickedDate, setPickedDate] = useState(defaultDate);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync pick date when mode changes to today
  useEffect(() => {
    if (dateMode === "today") setPickedDate(getTodayString());
  }, [dateMode]);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (dateMode === "recurring" && daysOfWeek.length === 0) return;
    setBusy(true);
    try {
      if (dateMode === "recurring") {
        await onSubmitRecurring?.(text.trim(), priority, daysOfWeek, endDate || null);
      } else {
        const isMisc = dateMode === "misc";
        const date = isMisc ? null : dateMode === "today" ? getTodayString() : pickedDate;
        await onSubmit(text.trim(), priority, date, isMisc, url.trim());
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const submitDisabled =
    busy ||
    !text.trim() ||
    (dateMode === "recurring" && daysOfWeek.length === 0);

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <motion.div
        className="modal-panel"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <div className="modal-header">
          <h3>Add Task</h3>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="modal-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to get done?"
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />

          {/* Priority */}
          <div className="modal-row">
            <span className="modal-label">Priority</span>
            <div className="priority-picker">
              {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`priority-option priority-${p} ${priority === p ? "selected" : ""}`}
                  onClick={() => setPriority(p)}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Date mode */}
          <div className="modal-row">
            <span className="modal-label">When</span>
            <div className="date-mode-picker">
              <button
                type="button"
                className={`date-mode-option ${dateMode === "today" ? "selected" : ""}`}
                onClick={() => setDateMode("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`date-mode-option ${dateMode === "pick" ? "selected" : ""}`}
                onClick={() => setDateMode("pick")}
              >
                <Calendar size={13} />
                Date
              </button>
              <button
                type="button"
                className={`date-mode-option ${dateMode === "misc" ? "selected" : ""}`}
                onClick={() => setDateMode("misc")}
              >
                <Inbox size={13} />
                Misc
              </button>
              <button
                type="button"
                className={`date-mode-option ${dateMode === "recurring" ? "selected" : ""}`}
                onClick={() => setDateMode("recurring")}
              >
                <Repeat size={13} />
                Recurring
              </button>
            </div>
          </div>

          {dateMode === "pick" && (
            <div className="modal-date-pick">
              <input
                type="date"
                value={pickedDate}
                min={getTodayString()}
                onChange={(e) => setPickedDate(e.target.value)}
                className="modal-date-input"
              />
            </div>
          )}

          {dateMode === "recurring" && (
            <>
              <div className="modal-recurring-days">
                {DAY_LETTERS.map((letter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`recurring-day-btn ${daysOfWeek.includes(idx) ? "active" : ""}`}
                    onClick={() => toggleDay(idx)}
                    title={DAY_LABELS[idx]}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <div className="modal-row">
                <span className="modal-label">Ends</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="modal-date-input"
                />
              </div>
            </>
          )}

          <input
            className="modal-url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            type="url"
          />

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitDisabled}>
              <Plus size={15} />
              {dateMode === "recurring" ? "Add Recurring" : "Add Task"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Calendar Task Pill ──────────────────────────────────────────────────────

function TaskPill({
  task,
  compact,
  onToggle,
  onDelete,
}: {
  task: Task;
  compact?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`task-pill priority-${task.priority} ${task.completed ? "done" : ""}`}>
      <button
        className={`pill-check ${task.completed ? "checked" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      />
      <span className="pill-text">{task.text}</span>
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          className="task-link-badge"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={10} />
        </a>
      )}
      {!compact && (
        <button
          className="pill-delete"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="Delete"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

// ─── Day Expand Modal ────────────────────────────────────────────────────────

const DAY_LABEL_FULL: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

function DayModal({
  date,
  tasks,
  overdueTasks,
  onClose,
  onRefresh,
  onAddTask,
}: {
  date: string;
  tasks: Task[];
  overdueTasks: Task[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAddTask: () => void;
}) {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [editDate, setEditDate] = useState(date);
  const [editIsMisc, setEditIsMisc] = useState(false);
  const [editUrl, setEditUrl] = useState("");
  const [recurringDelete, setRecurringDelete] = useState<Task | null>(null);
  const parsed = new Date(`${date}T12:00:00`);
  const dayName = parsed.toLocaleDateString(undefined, { weekday: "long" });
  const dateLabel = parsed.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  async function toggle(task: Task) {
    await api.updateTask(task.id, { completed: !task.completed });
    await onRefresh();
  }

  async function performDelete(task: Task) {
    await api.deleteTask(task.id);
    if (editingTaskId === task.id) {
      setEditingTaskId(null);
    }
    await onRefresh();
  }

  // Entry point for every delete button. Recurring tasks first ask whether to
  // remove just this occurrence or the whole series; plain tasks delete directly.
  function del(task: Task) {
    if (task.recurring_task_id) {
      setRecurringDelete(task);
    } else {
      void performDelete(task);
    }
  }

  async function deleteOccurrence(task: Task) {
    setRecurringDelete(null);
    await performDelete(task);
  }

  async function deleteSeries(task: Task) {
    setRecurringDelete(null);
    if (!task.recurring_task_id) return;
    await api.deleteRecurringTask(task.recurring_task_id);
    if (editingTaskId === task.id) {
      setEditingTaskId(null);
    }
    await onRefresh();
  }

  // Drop the task's date and park it in misc. The backend clears task_date on
  // is_misc, and the priority resets since the old date's urgency no longer applies.
  async function moveToMisc(task: Task) {
    await api.updateTask(task.id, {
      is_misc: true,
      priority: DEFAULT_TASK_PRIORITY,
    });
    if (editingTaskId === task.id) {
      setEditingTaskId(null);
    }
    await onRefresh();
  }

  function openEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditText(task.text);
    setEditPriority(task.priority);
    setEditDate(task.task_date ?? date);
    setEditIsMisc(task.is_misc);
    setEditUrl(task.url ?? "");
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditText("");
    setEditPriority(DEFAULT_TASK_PRIORITY);
    setEditDate(date);
    setEditIsMisc(false);
    setEditUrl("");
  }

  async function saveEdit(task: Task) {
    if (!editText.trim() || (!editIsMisc && !editDate)) {
      return;
    }
    await api.updateTask(task.id, {
      text: editText.trim(),
      priority: editPriority,
      date: editIsMisc ? null : editDate,
      is_misc: editIsMisc,
      url: editUrl.trim(),
    });
    cancelEdit();
    await onRefresh();
  }

  // overdueTasks are always incomplete by definition (uncompleted from previous days)
  const pendingToday = tasks.filter((t) => !t.completed) as (Task & { _overdue?: boolean })[];
  const pendingOverdue = overdueTasks.map((t) => ({ ...t, _overdue: true as const }));
  const done = tasks.filter((t) => t.completed) as (Task & { _overdue?: boolean })[];

  return createPortal(
    <div className="day-modal-backdrop" onClick={onClose}>
      <motion.div
        className="day-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${dayName} tasks`}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="day-modal-header">
          <div>
            <h3 className="day-modal-title">{dayName}</h3>
            <p className="day-modal-date">{dateLabel}</p>
          </div>
          <div className="day-modal-header-actions">
            <button className="secondary-button" onClick={onAddTask}>
              <Plus size={14} />
              Add Task
            </button>
            <button className="icon-button" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="day-modal-body">
          {pendingToday.length === 0 && pendingOverdue.length === 0 && done.length === 0 && (
            <p className="day-modal-empty">No tasks for this day.</p>
          )}

          {pendingToday.map((task) => (
            <div
              key={task.id}
              className={`day-modal-row${task._overdue ? " day-modal-row--overdue" : ""}${editingTaskId === task.id ? " editing" : ""}`}
            >
              <button
                className={`check-circle ${task.completed ? "checked" : ""}`}
                onClick={() => void toggle(task)}
              />
              {editingTaskId === task.id ? (
                <>
                  <div className="day-modal-main day-modal-main-editing">
                    <div className="day-modal-edit-top">
                      <input
                        className="day-modal-edit-field"
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void saveEdit(task);
                          }
                          if (event.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        autoFocus
                      />
                      <select
                        className="day-modal-edit-select"
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                      >
                        {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                          <option key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                      </select>
                    </div>
                    <div className="day-modal-edit-subrow">
                      {!editIsMisc ? (
                        <input
                          className="day-modal-edit-date"
                          type="date"
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                        />
                      ) : (
                        <span className="day-modal-edit-state">In misc</span>
                      )}
                      <button
                        type="button"
                        className="text-button day-modal-misc-link"
                        onClick={() => setEditIsMisc((current) => !current)}
                      >
                        {editIsMisc ? "Keep dated" : "Move to misc"}
                      </button>
                    </div>
                    <input
                      className="task-url-edit-input"
                      value={editUrl}
                      onChange={(event) => setEditUrl(event.target.value)}
                      placeholder="Link (optional)"
                      type="url"
                    />
                  </div>
                  {task._overdue && <span className="day-modal-overdue-tag">overdue</span>}
                  <div className="day-modal-actions">
                    <button
                      className="icon-button"
                      onClick={() => void saveEdit(task)}
                      aria-label={`Save ${task.text}`}
                      disabled={!editText.trim()}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={cancelEdit}
                      aria-label={`Cancel editing ${task.text}`}
                    >
                      <X size={14} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => void del(task)}
                      aria-label={`Delete ${task.text}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="day-modal-main">
                    <span className="day-modal-row-text">{task.text}</span>
                    {task.url && (
                      <a href={task.url} target="_blank" rel="noopener noreferrer" className="task-link-badge" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <div className="day-modal-actions">
                    <span className={`priority-badge priority-${task.priority}`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    {task._overdue && <span className="day-modal-overdue-tag">overdue</span>}
                    {task.recurring_task_id && (
                      <span className="day-modal-recurring-tag" title="Recurring task">
                        <Repeat size={12} />
                      </span>
                    )}
                    <button
                      className="icon-button"
                      onClick={() => void moveToMisc(task)}
                      aria-label={`Move ${task.text} to misc`}
                      title="Move to misc"
                    >
                      <Inbox size={14} />
                    </button>
                    <button
                      className="icon-button day-modal-menu-button"
                      onClick={() => openEdit(task)}
                      aria-label={`Edit ${task.text}`}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => del(task)}
                      aria-label={`Delete ${task.text}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {done.length > 0 && (
            <>
              <div className="day-modal-divider">Done</div>
              {done.map((task) => (
                <div
                  key={task.id}
                  className={`day-modal-row day-modal-row--done${editingTaskId === task.id ? " editing" : ""}`}
                >
                <button
                  className="check-circle checked"
                  onClick={() => void toggle(task)}
                />
                {editingTaskId === task.id ? (
                  <>
                    <div className="day-modal-main day-modal-main-editing">
                      <div className="day-modal-edit-top">
                        <input
                          className="day-modal-edit-field"
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void saveEdit(task);
                            }
                            if (event.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <select
                          className="day-modal-edit-select"
                          value={editPriority}
                          onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                        >
                          {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                            <option key={priority} value={priority}>
                            {PRIORITY_LABELS[priority]}
                          </option>
                        ))}
                        </select>
                      </div>
                      <div className="day-modal-edit-subrow">
                        {!editIsMisc ? (
                          <input
                            className="day-modal-edit-date"
                            type="date"
                            value={editDate}
                            onChange={(event) => setEditDate(event.target.value)}
                          />
                        ) : (
                          <span className="day-modal-edit-state">In misc</span>
                        )}
                        <button
                          type="button"
                          className="text-button day-modal-misc-link"
                          onClick={() => setEditIsMisc((current) => !current)}
                        >
                          {editIsMisc ? "Keep dated" : "Move to misc"}
                        </button>
                      </div>
                      <input
                        className="task-url-edit-input"
                        value={editUrl}
                        onChange={(event) => setEditUrl(event.target.value)}
                        placeholder="Link (optional)"
                        type="url"
                      />
                    </div>
                    <div className="day-modal-actions">
                      <button
                        className="icon-button"
                        onClick={() => void saveEdit(task)}
                        aria-label={`Save ${task.text}`}
                        disabled={!editText.trim()}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={cancelEdit}
                        aria-label={`Cancel editing ${task.text}`}
                      >
                        <X size={14} />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => void del(task)}
                        aria-label={`Delete ${task.text}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="day-modal-main">
                      <span className="day-modal-row-text">{task.text}</span>
                      {task.url && (
                        <a href={task.url} target="_blank" rel="noopener noreferrer" className="task-link-badge" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className="day-modal-actions">
                      <span className={`priority-badge priority-${task.priority}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <button
                        className="icon-button day-modal-menu-button"
                        onClick={() => openEdit(task)}
                        aria-label={`Edit ${task.text}`}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => void del(task)}
                        aria-label={`Delete ${task.text}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
                </div>
              ))}
            </>
          )}

          {pendingOverdue.length > 0 && (
            <>
              <h3 className="overdue-section-heading">Overdue</h3>
              {pendingOverdue.map((task) => (
                <div
                  key={task.id}
                  className={`day-modal-row day-modal-row--overdue${editingTaskId === task.id ? " editing" : ""}`}
                >
                  <button
                    className={`check-circle ${task.completed ? "checked" : ""}`}
                    onClick={() => void toggle(task)}
                  />
                  {editingTaskId === task.id ? (
                    <>
                      <div className="day-modal-main day-modal-main-editing">
                        <div className="day-modal-edit-top">
                          <input
                            className="day-modal-edit-field"
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void saveEdit(task);
                              if (event.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                          />
                          <select
                            className="day-modal-edit-select"
                            value={editPriority}
                            onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                          >
                            {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                              <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="day-modal-edit-subrow">
                          {!editIsMisc ? (
                            <input
                              className="day-modal-edit-date"
                              type="date"
                              value={editDate}
                              onChange={(event) => setEditDate(event.target.value)}
                            />
                          ) : (
                            <span className="day-modal-edit-state">In misc</span>
                          )}
                          <button
                            type="button"
                            className="text-button day-modal-misc-link"
                            onClick={() => setEditIsMisc((current) => !current)}
                          >
                            {editIsMisc ? "Keep dated" : "Move to misc"}
                          </button>
                        </div>
                      </div>
                      <div className="day-modal-actions">
                        <button className="icon-button" onClick={() => void saveEdit(task)} aria-label={`Save ${task.text}`} disabled={!editText.trim()}>
                          <Check size={14} />
                        </button>
                        <button className="icon-button" onClick={cancelEdit} aria-label={`Cancel editing ${task.text}`}>
                          <X size={14} />
                        </button>
                        <button className="icon-button danger" onClick={() => void del(task)} aria-label={`Delete ${task.text}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="day-modal-main">
                        <span className="day-modal-row-text">{task.text}</span>
                      </div>
                      <div className="day-modal-actions">
                        <span className={`priority-badge priority-${task.priority}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        <button
                          className="icon-button"
                          onClick={() => void moveToMisc(task)}
                          aria-label={`Move ${task.text} to misc`}
                          title="Move to misc"
                        >
                          <Inbox size={14} />
                        </button>
                        <button className="icon-button day-modal-menu-button" onClick={() => openEdit(task)} aria-label={`Edit ${task.text}`}>
                          <MoreHorizontal size={15} />
                        </button>
                        <button className="icon-button danger" onClick={() => void del(task)} aria-label={`Delete ${task.text}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

        </div>

        {recurringDelete && (
          <div
            className="recurring-confirm-backdrop"
            onClick={() => setRecurringDelete(null)}
          >
            <div className="recurring-confirm" onClick={(e) => e.stopPropagation()}>
              <div className="recurring-confirm-icon"><Repeat size={18} /></div>
              <p className="recurring-confirm-title">Delete recurring task</p>
              <p className="recurring-confirm-text">
                “{recurringDelete.text}” repeats. Delete just this day, or every occurrence?
              </p>
              <div className="recurring-confirm-actions">
                <button
                  className="secondary-button"
                  onClick={() => void deleteOccurrence(recurringDelete)}
                >
                  Just this one
                </button>
                <button
                  className="recurring-confirm-danger"
                  onClick={() => void deleteSeries(recurringDelete)}
                >
                  Delete all
                </button>
              </div>
              <button
                className="text-button recurring-confirm-cancel"
                onClick={() => setRecurringDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Week Calendar ───────────────────────────────────────────────────────────

function WeekCalendar({
  week,
  selectedDate,
  onSelectDate,
  onRefreshWeek,
  onAddTask,
  onExpandDay,
}: {
  week: WeekResponse;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onRefreshWeek: () => Promise<void>;
  onAddTask: (date: string) => void;
  onExpandDay: (date: string) => void;
}) {
  // onSelectDate kept for habits panel sync below the calendar
  const today = getTodayString();

  // Merge overdue into the earliest week day that is today or after
  const overdueMergedDate = week.days.find((d) => d.date >= today)?.date ?? week.days[0]?.date;

  const daysByDate = new Map(week.days.map((d) => [d.date, d]));

  async function toggleTask(task: Task) {
    await api.updateTask(task.id, { completed: !task.completed });
    await onRefreshWeek();
  }

  async function deleteTask(task: Task) {
    await api.deleteTask(task.id);
    await onRefreshWeek();
  }

  return (
    <div className="week-calendar">
      {week.days.map((day, idx) => {
        const isToday = day.date === today;
        const isSelected = day.date === selectedDate;
        const isPast = day.date < today;
        // Pre-week overdue (from before Monday)
        const legacyOverdue = day.date === overdueMergedDate ? week.overdue_tasks : [];
        // Within-week overdue: incomplete tasks from earlier days that have already passed
        const weekOverdue = day.date === overdueMergedDate
          ? week.days
              .filter((d) => d.date < day.date && d.date < today)
              .flatMap((d) => d.tasks.filter((t) => !t.completed))
          : [];
        const allOverdue = [...legacyOverdue, ...weekOverdue];

        const pendingTasks = day.tasks.filter((t) => !t.completed);
        const doneTasks = day.tasks.filter((t) => t.completed);

        const MAX_PILLS = 4;
        const totalItems = pendingTasks.length + (allOverdue.length > 0 ? 1 : 0) + allOverdue.length + doneTasks.length;
        let remaining = MAX_PILLS;
        const shownPending = pendingTasks.slice(0, remaining);
        remaining = Math.max(0, remaining - shownPending.length);
        const showOverdueDivider = allOverdue.length > 0 && remaining > 0;
        if (showOverdueDivider) remaining = Math.max(0, remaining - 1);
        const shownOverdue = allOverdue.slice(0, remaining);
        remaining = Math.max(0, remaining - shownOverdue.length);
        const shownDone = doneTasks.slice(0, remaining);
        const hiddenCount = totalItems - shownPending.length - (showOverdueDivider ? 1 : 0) - shownOverdue.length - shownDone.length;

        return (
          <div
            key={day.date}
            className={`cal-day ${isToday ? "cal-today" : ""} ${isSelected ? "cal-selected" : ""} ${isPast && !isToday ? "cal-past" : ""}`}
            onClick={() => onSelectDate(day.date)}
          >
            <div className="cal-day-header-shell">
              <button
                type="button"
                className="cal-day-header"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDate(day.date);
                  onExpandDay(day.date);
                }}
                aria-label={`Open ${DAY_NAMES[idx]} ${formatDayLabel(day.date)} details`}
              >
                <span className="cal-day-name">{DAY_NAMES[idx]}</span>
                <span className="cal-day-num">{new Date(`${day.date}T12:00:00`).getDate()}</span>
              </button>
            </div>

            <div className="cal-day-tasks">
              {shownPending.map((task) => (
                <TaskPill
                  key={task.id}
                  task={task}
                  onToggle={() => void (async () => { await toggleTask(task); })()}
                  onDelete={() => void (async () => { await deleteTask(task); })()}
                />
              ))}

              {showOverdueDivider && (
                <>
                  <div className="cal-overdue-divider" />
                  {shownOverdue.map((task) => (
                    <div key={`od-${task.id}`} className="task-pill overdue-pill priority-high">
                      <button
                        className="pill-check"
                        onClick={(e) => { e.stopPropagation(); void toggleTask(task); }}
                      />
                      <span className="pill-text">{task.text}</span>
                      <button
                        className="pill-delete"
                        onClick={(e) => { e.stopPropagation(); void deleteTask(task); }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {shownDone.map((task) => (
                <TaskPill
                  key={task.id}
                  task={task}
                  onToggle={() => void (async () => { await toggleTask(task); })()}
                  onDelete={() => void (async () => { await deleteTask(task); })()}
                />
              ))}

              {hiddenCount > 0 && (
                <div className="cal-more-pill">+{hiddenCount} more</div>
              )}
            </div>

            <button
              className="cal-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAddTask(day.date);
              }}
              aria-label={`Add task for ${formatDayLabel(day.date)}`}
            >
              <Plus size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Misc Tasks Panel ────────────────────────────────────────────────────────

function MiscPanel({
  tasks,
  onRefreshWeek,
  onAdd,
  embedded,
}: {
  tasks: Task[];
  onRefreshWeek: () => Promise<void>;
  onAdd: () => void;
  embedded?: boolean;
}) {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [editUrl, setEditUrl] = useState("");
  const dateInputsRef = useRef<Map<number, HTMLInputElement>>(new Map());

  async function toggle(task: Task) {
    await api.updateTask(task.id, { completed: !task.completed });
    await onRefreshWeek();
  }

  async function del(task: Task) {
    await api.deleteTask(task.id);
    if (editingTaskId === task.id) {
      setEditingTaskId(null);
    }
    await onRefreshWeek();
  }

  function openEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditText(task.text);
    setEditPriority(task.priority);
    setEditUrl(task.url ?? "");
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditText("");
    setEditPriority(DEFAULT_TASK_PRIORITY);
    setEditUrl("");
  }

  async function saveEdit(task: Task) {
    if (!editText.trim()) {
      return;
    }
    await api.updateTask(task.id, {
      text: editText.trim(),
      priority: editPriority,
      url: editUrl.trim(),
    });
    cancelEdit();
    await onRefreshWeek();
  }

  async function moveToToday(task: Task) {
    await api.updateTask(task.id, { date: getTodayString(), is_misc: false });
    await onRefreshWeek();
  }

  async function scheduleToDate(task: Task, date: string) {
    await api.updateTask(task.id, { date, is_misc: false });
    await onRefreshWeek();
  }

  function openDatePicker(taskId: number) {
    const input = dateInputsRef.current.get(taskId);
    if (input) {
      input.value = "";
      input.showPicker?.();
    }
  }

  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const miscInner = (
    <>
      <div className="surface-header">
        <div>
          <h3>Misc</h3>
        </div>
        <button className="secondary-button" onClick={onAdd}>
          <Plus size={14} />
          Add
        </button>
      </div>

      <div className="misc-task-list">
        {pending.map((task) => (
          <div key={task.id} className={`misc-task-row ${editingTaskId === task.id ? "editing" : ""}`}>
            <button
              className={`check-circle ${task.completed ? "checked" : ""}`}
              onClick={() => void toggle(task)}
            >
              {task.completed ? "✓" : ""}
            </button>
            {editingTaskId === task.id ? (
              <>
                <div className="misc-task-main misc-task-main-editing">
                  <input
                    className="misc-task-edit-field"
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void saveEdit(task);
                      }
                      if (event.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    autoFocus
                  />
                  <select
                    className="misc-task-edit-select"
                    value={editPriority}
                    onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                  >
                    {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="task-url-edit-input"
                    value={editUrl}
                    onChange={(event) => setEditUrl(event.target.value)}
                    placeholder="Link (optional)"
                    type="url"
                  />
                </div>
                <div className="misc-task-actions">
                  <button
                    className="icon-button"
                    onClick={() => void saveEdit(task)}
                    aria-label={`Save ${task.text}`}
                    disabled={!editText.trim()}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={cancelEdit}
                    aria-label={`Cancel editing ${task.text}`}
                  >
                    <X size={14} />
                  </button>
                  <button
                    className="icon-button danger"
                    onClick={() => void del(task)}
                    aria-label={`Delete ${task.text}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="misc-task-main">
                  <span className={`row-label misc-task-text ${task.completed ? "done-text" : ""}`}>{task.text}</span>
                  {task.url && (
                    <a href={task.url} target="_blank" rel="noopener noreferrer" className="task-link-badge" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="misc-task-actions">
                    <span className={`priority-badge priority-${task.priority}`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    <button
                      className="icon-button"
                      onClick={() => void moveToToday(task)}
                      aria-label={`Move ${task.text} to today`}
                      title="Move to today"
                    >
                      <CalendarCheck size={14} />
                    </button>
                    <div className="misc-date-picker-wrapper">
                      <button
                        className="icon-button"
                        onClick={() => openDatePicker(task.id)}
                        aria-label={`Pick date for ${task.text}`}
                        title="Schedule to a date"
                      >
                        <Calendar size={14} />
                      </button>
                      <input
                        type="date"
                        className="misc-hidden-date-input"
                        min={getTodayString()}
                        ref={(el) => {
                          if (el) dateInputsRef.current.set(task.id, el);
                          else dateInputsRef.current.delete(task.id);
                        }}
                        onChange={(e) => {
                          if (e.target.value) void scheduleToDate(task, e.target.value);
                        }}
                      />
                    </div>
                    <button
                      className="icon-button misc-task-menu-button"
                      onClick={() => openEdit(task)}
                      aria-label={`Edit ${task.text}`}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => void del(task)}
                      aria-label={`Delete ${task.text}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
              </>
            )}
          </div>
        ))}

        {done.length > 0 && (
          <>
            {done.map((task) => (
              <div key={task.id} className={`misc-task-row done-row ${editingTaskId === task.id ? "editing" : ""}`}>
                <button
                  className="check-circle checked"
                  onClick={() => void toggle(task)}
                >
                  ✓
                </button>
                {editingTaskId === task.id ? (
                  <>
                    <div className="misc-task-main misc-task-main-editing">
                      <input
                        className="misc-task-edit-field"
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void saveEdit(task);
                          }
                          if (event.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        autoFocus
                      />
                      <select
                        className="misc-task-edit-select"
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                      >
                        {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                          <option key={priority} value={priority}>
                            {PRIORITY_LABELS[priority]}
                          </option>
                        ))}
                      </select>
                      <input
                        className="task-url-edit-input"
                        value={editUrl}
                        onChange={(event) => setEditUrl(event.target.value)}
                        placeholder="Link (optional)"
                        type="url"
                      />
                    </div>
                    <div className="misc-task-actions">
                      <button
                        className="icon-button"
                        onClick={() => void saveEdit(task)}
                        aria-label={`Save ${task.text}`}
                        disabled={!editText.trim()}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={cancelEdit}
                        aria-label={`Cancel editing ${task.text}`}
                      >
                        <X size={14} />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => void del(task)}
                        aria-label={`Delete ${task.text}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="misc-task-main">
                      <span className="row-label misc-task-text done-text">{task.text}</span>
                      {task.url && (
                        <a href={task.url} target="_blank" rel="noopener noreferrer" className="task-link-badge" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className="misc-task-actions">
                      <span className={`priority-badge priority-${task.priority}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <button
                        className="icon-button misc-task-menu-button"
                        onClick={() => openEdit(task)}
                        aria-label={`Edit ${task.text}`}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => void del(task)}
                        aria-label={`Delete ${task.text}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {tasks.length === 0 && (
          <div className="empty-state">
            <p>No misc items. Add things you want to do eventually with no fixed date.</p>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return miscInner;
  return <motion.section className="surface-card misc-panel" {...reveal}>{miscInner}</motion.section>;
}

// ─── Today Tasks Panel ───────────────────────────────────────────────────────

function TodayTasksPanel({
  data,
  onRefresh,
  onAddTask,
}: {
  data: TodayResponse;
  onRefresh: () => Promise<void>;
  onAddTask: () => void;
}) {
  const pending = data.tasks.filter((t) => !t.completed);
  const done = data.tasks.filter((t) => t.completed);
  const overdue = data.overdue_tasks;
  const total = data.tasks.length;
  const completedCount = done.length;

  async function toggle(task: Task) {
    await api.updateTask(task.id, { completed: !task.completed });
    await onRefresh();
  }

  return (
    <motion.section className="surface-card today-tasks-panel" {...reveal}>
      <div className="surface-header">
        <div>
          <h3>Tasks</h3>
        </div>
        <div className="today-tasks-header-right">
          <span className="habit-count">{completedCount}/{total}</span>
          <button className="secondary-button" onClick={onAddTask}>
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      <div className="habits-grid">
        {pending.map((task) => (
          <div key={task.id} className="habit-entry">
            <div className={`habit-row today-task-row priority-row-${task.priority}`}>
              <button
                className={`check-circle ${task.completed ? "checked" : ""}`}
                onClick={() => void toggle(task)}
              >
                {task.completed ? "✓" : ""}
              </button>
              <span className="row-label">{task.text}</span>
              {task.url && (
                <a href={task.url} target="_blank" rel="noopener noreferrer" className="task-link-badge" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))}

        {pending.length === 0 && overdue.length === 0 && done.length === 0 && (
          <div className="empty-state">
            <p>Nothing scheduled for today.</p>
          </div>
        )}

        {done.length > 0 && (
          <>
            {done.map((task) => (
              <div key={task.id} className="habit-entry">
                <div className="habit-row today-task-row today-task-done">
                  <button
                    className="check-circle checked"
                    onClick={() => void toggle(task)}
                  >
                    ✓
                  </button>
                  <span className="row-label done-text">{task.text}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {overdue.length > 0 && (
          <>
            <div className="overdue-section-heading">Overdue</div>
            {overdue.map((task) => (
              <div key={task.id} className="habit-entry">
                <div className="habit-row today-task-row today-task-overdue">
                  <button
                    className={`check-circle ${task.completed ? "checked" : ""}`}
                    onClick={() => void toggle(task)}
                  >
                    {task.completed ? "✓" : ""}
                  </button>
                  <span className="row-label today-task-overdue-text">{task.text}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </motion.section>
  );
}

// ─── Habits Panel ────────────────────────────────────────────────────────────

function HabitsPanel({
  data,
  guitar,
  workouts,
  onRefresh,
  embedded,
}: {
  data: TodayResponse;
  guitar: ModuleResponse | null;
  workouts: ModuleResponse | null;
  onRefresh: () => Promise<void>;
  embedded?: boolean;
}) {
  const [showGuitarDetails, setShowGuitarDetails] = useState(false);
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);

  const todayWorkoutSessions = (workouts?.sessions ?? []).filter(
    (s) => s.session_date === data.date,
  );
  const todayGuitarSessions = (guitar?.sessions ?? []).filter(
    (s) => s.session_date === data.date,
  );

  const orderedHabits = [...data.habits].sort(
    (a, b) =>
      Number(Boolean(a.completed)) - Number(Boolean(b.completed)) ||
      a.sort_order - b.sort_order ||
      a.id - b.id,
  );

  async function toggleHabit(habitId: number, completed: boolean, habitName: string) {
    if (SESSION_BACKED_HABIT_NAMES.has(habitName)) {
      if (habitName === "Guitar") setShowGuitarDetails(true);
      if (habitName === "Exercise") setShowExerciseDetails(true);
      return;
    }
    await api.logHabit(habitId, !completed, data.date);
    await onRefresh();
  }

  const completedCount = data.habits.filter((h) => h.completed).length;

  const inner = (
    <>
      <div className="surface-header">
        <div>
          <h3>Habits</h3>
        </div>
        <span className="habit-count">
          {completedCount}/{data.habits.length}
        </span>
      </div>

      <div className="habits-grid">
        {orderedHabits.map((habit) => {
          const isGuitar = habit.name === "Guitar";
          const isExercise = habit.name === "Exercise";
          return (
            <div key={habit.id} className="habit-entry">
              <div className="habit-row">
                <button
                  className={`check-circle ${habit.completed ? "checked" : ""}`}
                  onClick={() => void toggleHabit(habit.id, Boolean(habit.completed), habit.name)}
                >
                  {habit.completed ? "✓" : ""}
                </button>
                <button
                  className="row-label"
                  onClick={() => void toggleHabit(habit.id, Boolean(habit.completed), habit.name)}
                >
                  {habit.name}
                </button>
                {isGuitar && (
                  <button
                    className={`icon-toggle ${showGuitarDetails ? "open" : ""}`}
                    onClick={() => setShowGuitarDetails((v) => !v)}
                    aria-label="Toggle guitar details"
                  >
                    <ChevronDown size={16} />
                  </button>
                )}
                {isExercise && (
                  <button
                    className={`icon-toggle ${showExerciseDetails ? "open" : ""}`}
                    onClick={() => setShowExerciseDetails((v) => !v)}
                    aria-label="Toggle exercise details"
                  >
                    <ChevronDown size={16} />
                  </button>
                )}
              </div>

              {isGuitar && showGuitarDetails && (
                <GuitarSessionDetails
                  date={data.date}
                  guitar={guitar}
                  sessions={todayGuitarSessions}
                  onRefresh={onRefresh}
                  onSessionCreated={() => setShowGuitarDetails(false)}
                />
              )}
              {isExercise && showExerciseDetails && (
                <ExerciseSessionDetails
                  date={data.date}
                  workouts={workouts}
                  sessions={todayWorkoutSessions}
                  onRefresh={onRefresh}
                  onSessionCreated={() => setShowExerciseDetails(false)}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) return inner;
  return <motion.section className="surface-card habits-panel" {...reveal}>{inner}</motion.section>;
}

// ─── Notes Panel ─────────────────────────────────────────────────────────────

function NotesPanel() {
  const [notesText, setNotesText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB on mount; fall back to legacy localStorage for one-time migration
  useEffect(() => {
    api.getNotes().then((res) => {
      if (res.content) {
        setNotesText(res.content);
      } else {
        // One-time migration from localStorage
        const legacy = window.localStorage.getItem(NOTES_LEGACY_KEY) ?? "";
        if (legacy) {
          setNotesText(legacy);
          api.saveNotes(legacy).then(() => {
            window.localStorage.removeItem(NOTES_LEGACY_KEY);
          });
        }
      }
      setLoaded(true);
    });
  }, []);

  // Debounced save to DB (500 ms after the last keystroke)
  useEffect(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.saveNotes(notesText);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [notesText, loaded]);

  function insertNotesPrefix(prefix: string) {
    const textarea = notesRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd, value } = textarea;
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const prefixWithSpacing = selectionStart > lineStart ? `\n${prefix}` : prefix;
    const nextValue =
      `${value.slice(0, selectionStart)}${prefixWithSpacing}${value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + prefixWithSpacing.length;
    setNotesText(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <motion.section className="surface-card" {...reveal}>
      <div className="notes-header">
        <h3>Notes</h3>
        <div className="notes-toolbar">
          <button className="notes-fmt-btn" type="button" onClick={() => insertNotesPrefix("- ")}>— bullet</button>
          <button className="notes-fmt-btn" type="button" onClick={() => insertNotesPrefix("[] ")}>☐ check</button>
          <button className="notes-fmt-btn" type="button" onClick={() => insertNotesPrefix("1. ")}>1. list</button>
        </div>
      </div>
      <textarea
        ref={notesRef}
        className="field-textarea today-notes-area"
        rows={8}
        value={notesText}
        onChange={(e) => setNotesText(e.target.value)}
        onKeyDown={handleTodayNotesKeyDown}
        placeholder={"- Capture loose thoughts\n- Jot next steps\n[] Leave yourself a checkbox"}
      />
    </motion.section>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function TodayPage({
  data,
  guitar,
  workouts,
  selectedDate,
  onDateChange,
  onRefresh,
  showNotes = false,
}: {
  data: TodayResponse;
  guitar: ModuleResponse | null;
  workouts: ModuleResponse | null;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => Promise<void>;
  showNotes?: boolean;
}) {
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(selectedDate));
  const [addModalDate, setAddModalDate] = useState<string | null>(null);
  const [addMisc, setAddMisc] = useState(false);
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null);

  const today = getTodayString();

  // "n" opens the add-task modal; "t" opens the day expand modal for the selected day
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setAddModalDate((prev) => (prev === null ? selectedDate : prev));
      }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setExpandedDayDate((prev) => (prev === null ? selectedDate : null));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDate]);

  const fetchWeek = useCallback(
    async (start: string) => {
      const w = await api.getWeek(start);
      setWeek(w);
    },
    [],
  );

  useEffect(() => {
    void fetchWeek(weekStart);
  }, [weekStart, fetchWeek]);

  // Also refresh week when onRefresh is called (tasks change)
  async function refreshAll() {
    await Promise.all([onRefresh(), fetchWeek(weekStart)]);
  }

  function goToPrevWeek() {
    setWeekStart((ws) => shiftDate(ws, -7));
  }

  function goToNextWeek() {
    setWeekStart((ws) => shiftDate(ws, 7));
  }

  function goToCurrentWeek() {
    const ws = getWeekStart(today);
    setWeekStart(ws);
    onDateChange(today);
  }

  async function handleAddTask(
    text: string,
    priority: TaskPriority,
    date: string | null,
    is_misc: boolean,
    url: string = "",
  ) {
    await api.createTask(text, { date: date ?? undefined, priority, is_misc, url });
    await refreshAll();
  }

  async function handleAddRecurring(
    text: string,
    priority: TaskPriority,
    days_of_week: number[],
    end_date: string | null,
  ) {
    await api.createRecurringTask({ text, priority, days_of_week, end_date });
    await refreshAll();
  }

  // When user selects a date in the calendar, also update the "today" view date for habits
  function handleSelectDate(date: string) {
    onDateChange(date);
    // If the selected date is outside the current week, shift week
    const ws = getWeekStart(date);
    if (ws !== weekStart) setWeekStart(ws);
  }

  const weekLabel = week
    ? formatWeekLabel(week.start, week.end)
    : formatWeekLabel(weekStart, shiftDate(weekStart, 6));

  const isCurrentWeek = weekStart === getWeekStart(today);

  return (
    <section className="page today-page">
      {/* Add Task Modal */}
      {(addModalDate !== null || addMisc) && (
        <AddTaskModal
          defaultDate={addModalDate ?? today}
          defaultMisc={addMisc}
          onClose={() => {
            setAddModalDate(null);
            setAddMisc(false);
          }}
          onSubmit={async (text, priority, date, is_misc) => {
            await handleAddTask(text, priority, date, is_misc);
          }}
          onSubmitRecurring={handleAddRecurring}
        />
      )}

      {/* Header */}
      <motion.div className="today-header" {...reveal}>
        <div className="today-title-block">
          <h2 className="hero-title">Tasks</h2>
          <p className="hero-copy">
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="week-nav">
          <button className="icon-button" onClick={goToPrevWeek} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <span className="week-label">{weekLabel}</span>
          <button
            className="secondary-button"
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek && selectedDate === today}
          >
            Today
          </button>
          <button className="icon-button" onClick={goToNextWeek} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="add-task-btn-row">
          <button
            className="primary-button add-task-btn"
            onClick={() => setAddModalDate(selectedDate)}
          >
            <Plus size={15} />
            Add Task
          </button>
          <kbd className="kbd-hint">N</kbd>
          <span className="kbd-hint-sep">·</span>
          <kbd className="kbd-hint">T</kbd>
        </div>
      </motion.div>

      {/* Day expand modal */}
      {expandedDayDate !== null && week && (() => {
        const dayData = week.days.find((d) => d.date === expandedDayDate);
        // Legacy overdue = tasks from before the week start (backend already computes these)
        const overdueMergedDate = week.days.find((d) => d.date >= today)?.date ?? week.days[0]?.date;
        const legacyOverdue = expandedDayDate === overdueMergedDate ? week.overdue_tasks : [];
        // Within-week overdue = incomplete tasks from past days earlier in this week
        const weekOverdue = week.days
          .filter((d) => d.date < expandedDayDate && d.date < today)
          .flatMap((d) => d.tasks.filter((t) => !t.completed));
        const overdueForDay = [...legacyOverdue, ...weekOverdue];
        return (
          <DayModal
            date={expandedDayDate}
            tasks={dayData?.tasks ?? []}
            overdueTasks={overdueForDay}
            onClose={() => setExpandedDayDate(null)}
            onRefresh={refreshAll}
            onAddTask={() => { setAddModalDate(expandedDayDate); setExpandedDayDate(null); }}
          />
        );
      })()}

      {/* Week Calendar */}
      <motion.section className="calendar-card" {...reveal}>
        <div className="calendar-scroll-shell">
          {week ? (
            <WeekCalendar
              week={week}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onRefreshWeek={() => fetchWeek(weekStart)}
              onAddTask={(date) => setAddModalDate(date)}
              onExpandDay={(date) => setExpandedDayDate(date)}
            />
          ) : (
            <div className="cal-loading">Loading week&hellip;</div>
          )}
        </div>
      </motion.section>

      {/* Tasks (left) + Habits & Misc combined (right) */}
      <div className="tasks-habits-grid">
        {/* Left: today's tasks as a checklist */}
        <TodayTasksPanel
          data={data}
          onRefresh={refreshAll}
          onAddTask={() => setAddModalDate(today)}
        />

        {/* Right: habits + misc in one card */}
        <motion.section className="surface-card habits-misc-combined" {...reveal}>
          <HabitsPanel
            data={data}
            guitar={guitar}
            workouts={workouts}
            onRefresh={refreshAll}
            embedded
          />
          {week && (
            <MiscPanel
              tasks={week.misc_tasks}
              onRefreshWeek={() => fetchWeek(weekStart)}
              onAdd={() => setAddMisc(true)}
              embedded
            />
          )}
        </motion.section>
      </div>

      {/* Notes */}
      {showNotes && <NotesPanel />}
    </section>
  );
}
