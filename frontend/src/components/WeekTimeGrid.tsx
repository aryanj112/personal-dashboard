import { DragEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import type { CalendarBlock, Habit, Task, WeekResponse } from "../lib/types";

const SLOT_MINUTES = 15;
const DEFAULT_DURATION = 30;
const MIN_DURATION = 15;
const HOUR_HEIGHT = 52; // px
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** What a drag is carrying. Read on drop to decide create-vs-move. */
type DragPayload =
  | { source: "task"; taskId: number }
  | { source: "habit"; habitId: number }
  | { source: "temp"; label: string }
  | { source: "block"; blockId: number; grabOffsetMinutes: number };

const DRAG_MIME = "application/x-personal-block";

function snap(minute: number) {
  return Math.max(0, Math.min(24 * 60 - SLOT_MINUTES, Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES));
}

function formatTime(minute: number) {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Lay overlapping blocks side by side. Blocks are grouped into clusters that
 * transitively overlap, then each cluster is packed into the fewest columns.
 */
function layoutBlocks(blocks: CalendarBlock[]) {
  const sorted = [...blocks].sort(
    (a, b) => a.startMinute - b.startMinute || a.durationMinutes - b.durationMinutes,
  );
  const placements = new Map<number, { column: number; columns: number }>();

  let cluster: CalendarBlock[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const assigned = new Map<number, number>();
    for (const block of cluster) {
      let col = columnEnds.findIndex((end) => end <= block.startMinute);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[col] = block.startMinute + block.durationMinutes;
      assigned.set(block.id, col);
    }
    for (const block of cluster) {
      placements.set(block.id, {
        column: assigned.get(block.id) ?? 0,
        columns: columnEnds.length,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const block of sorted) {
    if (cluster.length > 0 && block.startMinute >= clusterEnd) flush();
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.startMinute + block.durationMinutes);
  }
  flush();

  return placements;
}

export function WeekTimeGrid({
  week,
  habits,
  selectedDate,
  onSelectDate,
  onExpandDay,
  onAddTask,
  onRefresh,
}: {
  week: WeekResponse;
  habits: Habit[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onExpandDay: (date: string) => void;
  onAddTask: (date: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [tempLabel, setTempLabel] = useState("");
  const [dropHint, setDropHint] = useState<{ date: string; minute: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const today = getTodayString();

  const loadBlocks = useCallback(async () => {
    const data = await api.getCalendarBlocks(week.start, week.end);
    setBlocks(data);
  }, [week.start, week.end]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  // Open on the working day rather than midnight.
  useEffect(() => {
    if (scrolledRef.current || !gridRef.current) return;
    gridRef.current.scrollTop = 7 * HOUR_HEIGHT;
    scrolledRef.current = true;
  }, []);

  const scheduledTaskIds = new Set(
    blocks.filter((b) => b.kind === "task" && b.taskId !== null).map((b) => b.taskId as number),
  );

  // Overdue tasks have no day of their own this week, so surface them on the
  // first day that is today-or-later — same as the old calendar did — where they
  // stay draggable onto a time.
  const overdueHostDate = week.days.find((d) => d.date >= today)?.date ?? week.days[0]?.date;

  function minuteFromEvent(event: { clientY: number }, column: HTMLElement) {
    const rect = column.getBoundingClientRect();
    return snap((event.clientY - rect.top) / PX_PER_MINUTE);
  }

  function startDrag(event: DragEvent, payload: DragPayload) {
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  }

  function readDrag(event: DragEvent): DragPayload | null {
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  function handleColumnDragOver(event: DragEvent<HTMLDivElement>, date: string) {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropHint({ date, minute: minuteFromEvent(event, event.currentTarget) });
  }

  async function handleColumnDrop(event: DragEvent<HTMLDivElement>, date: string) {
    event.preventDefault();
    const payload = readDrag(event);
    setDropHint(null);
    if (!payload) return;

    const dropMinute = minuteFromEvent(event, event.currentTarget);

    if (payload.source === "block") {
      const start = snap(dropMinute - payload.grabOffsetMinutes);
      const moved = blocks.find((b) => b.id === payload.blockId);
      // Optimistic: the block follows the cursor immediately.
      setBlocks((prev) =>
        prev.map((b) => (b.id === payload.blockId ? { ...b, date, startMinute: start } : b)),
      );
      await api.updateCalendarBlock(payload.blockId, { date, start_minute: start });
      // Keep the underlying task's due date in step with where it now sits.
      if (moved?.kind === "task" && moved.taskId !== null && moved.date !== date) {
        await api.updateTask(moved.taskId, { date });
      }
      await Promise.all([loadBlocks(), onRefresh()]);
      return;
    }

    if (payload.source === "task") {
      await api.createCalendarBlock({
        date,
        start_minute: dropMinute,
        duration_minutes: DEFAULT_DURATION,
        kind: "task",
        task_id: payload.taskId,
      });
      // Scheduling a task onto a day also re-dates it, so an overdue task
      // dropped on Thursday stops being overdue.
      await api.updateTask(payload.taskId, { date });
      await Promise.all([loadBlocks(), onRefresh()]);
      return;
    }

    if (payload.source === "habit") {
      await api.createCalendarBlock({
        date,
        start_minute: dropMinute,
        duration_minutes: DEFAULT_DURATION,
        kind: "habit",
        habit_id: payload.habitId,
      });
    } else {
      if (!payload.label.trim()) return;
      await api.createCalendarBlock({
        date,
        start_minute: dropMinute,
        duration_minutes: DEFAULT_DURATION,
        kind: "temp",
        label: payload.label.trim(),
      });
      setTempLabel("");
    }
    await loadBlocks();
  }

  // Resize by dragging the bottom edge. Pointer events give continuous feedback
  // that HTML5 drag-and-drop can't.
  function startResize(event: ReactPointerEvent<HTMLDivElement>, block: CalendarBlock) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startDuration = block.durationMinutes;
    let latest = startDuration;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaMinutes = (moveEvent.clientY - startY) / PX_PER_MINUTE;
      const next = Math.max(
        MIN_DURATION,
        Math.min(24 * 60 - block.startMinute, snap(startDuration + deltaMinutes)),
      );
      if (next !== latest) {
        latest = next;
        setBlocks((prev) =>
          prev.map((b) => (b.id === block.id ? { ...b, durationMinutes: next } : b)),
        );
      }
    };

    const onUp = async () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      if (latest !== startDuration) {
        await api.updateCalendarBlock(block.id, { duration_minutes: latest });
        await loadBlocks();
      }
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  async function toggleBlock(block: CalendarBlock) {
    const next = !block.completed;
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, completed: next } : b)));

    if (block.kind === "task" && block.taskId !== null) {
      await api.updateTask(block.taskId, { completed: next });
    } else if (block.kind === "habit" && block.habitId !== null) {
      await api.logHabit(block.habitId, next, block.date);
    } else {
      await api.updateCalendarBlock(block.id, { completed: next });
    }
    // Habits and tasks are shown elsewhere too, so refresh the whole page state.
    await Promise.all([loadBlocks(), onRefresh()]);
  }

  async function removeBlock(block: CalendarBlock) {
    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    await api.deleteCalendarBlock(block.id);
    await loadBlocks();
  }

  return (
    <div className="wtg">
      {/* Palette: drag these onto the grid */}
      <div className="wtg-palette">
        <span className="wtg-palette-label">Drag onto the calendar</span>
        <div className="wtg-palette-chips">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="wtg-chip wtg-chip-habit"
              draggable
              onDragStart={(e) => startDrag(e, { source: "habit", habitId: habit.id })}
              title={`Schedule ${habit.name}`}
            >
              {habit.name}
            </div>
          ))}

          <div className="wtg-temp-maker">
            <input
              className="wtg-temp-input"
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              placeholder="One-off block…"
              aria-label="Name a one-off block, then drag the chip onto the calendar"
            />
            <div
              className={`wtg-chip wtg-chip-temp ${tempLabel.trim() ? "" : "is-empty"}`}
              draggable={Boolean(tempLabel.trim())}
              onDragStart={(e) => startDrag(e, { source: "temp", label: tempLabel })}
              title={tempLabel.trim() ? `Drag "${tempLabel.trim()}" onto the calendar` : "Type a name first"}
            >
              <Plus size={12} />
              {tempLabel.trim() || "temp"}
            </div>
          </div>
        </div>
      </div>

      {/* Day headers + unscheduled tasks */}
      <div className="wtg-header">
        <div className="wtg-gutter-spacer" />
        {week.days.map((day, idx) => {
          const dayTasks = day.tasks.filter((t) => !scheduledTaskIds.has(t.id));
          const overdueTasks =
            day.date === overdueHostDate
              ? week.overdue_tasks.filter((t) => !scheduledTaskIds.has(t.id))
              : [];
          const unscheduled = [
            ...dayTasks.map((t) => ({ task: t, overdue: false })),
            ...overdueTasks.map((t) => ({ task: t, overdue: true })),
          ];
          return (
            <div
              key={day.date}
              className={`wtg-header-col ${day.date === today ? "is-today" : ""} ${
                day.date === selectedDate ? "is-selected" : ""
              }`}
              onClick={() => onSelectDate(day.date)}
            >
              <button
                type="button"
                className="wtg-day-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDate(day.date);
                  onExpandDay(day.date);
                }}
              >
                <span className="wtg-day-name">{DAY_NAMES[idx]}</span>
                <span className="wtg-day-num">{new Date(`${day.date}T12:00:00`).getDate()}</span>
              </button>

              <div className="wtg-unscheduled">
                {unscheduled.map(({ task, overdue }: { task: Task; overdue: boolean }) => (
                  <div
                    key={task.id}
                    className={`wtg-task-chip priority-${task.priority} ${
                      task.completed ? "is-done" : ""
                    } ${overdue ? "is-overdue" : ""}`}
                    draggable
                    onDragStart={(e) => startDrag(e, { source: "task", taskId: task.id })}
                    title={
                      overdue
                        ? `Overdue — drag "${task.text}" onto a time`
                        : `Drag "${task.text}" onto a time`
                    }
                  >
                    <span className="wtg-task-chip-text">{task.text}</span>
                    {task.url && (
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="task-link-badge"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="wtg-add-task"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTask(day.date);
                  }}
                  aria-label={`Add task on ${day.date}`}
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrolling time grid */}
      <div className="wtg-scroll" ref={gridRef}>
        <div className="wtg-body" style={{ height: 24 * HOUR_HEIGHT }}>
          <div className="wtg-gutter">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="wtg-hour-label" style={{ top: hour * HOUR_HEIGHT }}>
                {hour === 0 ? "" : formatTime(hour * 60)}
              </div>
            ))}
          </div>

          {week.days.map((day) => {
            const dayBlocks = blocks.filter((b) => b.date === day.date);
            const placements = layoutBlocks(dayBlocks);
            return (
              <div
                key={day.date}
                className={`wtg-col ${day.date === today ? "is-today" : ""}`}
                onDragOver={(e) => handleColumnDragOver(e, day.date)}
                onDragLeave={() => setDropHint(null)}
                onDrop={(e) => void handleColumnDrop(e, day.date)}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="wtg-hour-line" style={{ top: hour * HOUR_HEIGHT }} />
                ))}

                {dropHint?.date === day.date && (
                  <div
                    className="wtg-drop-hint"
                    style={{
                      top: dropHint.minute * PX_PER_MINUTE,
                      height: DEFAULT_DURATION * PX_PER_MINUTE,
                    }}
                  >
                    {formatTime(dropHint.minute)}
                  </div>
                )}

                {dayBlocks.map((block) => {
                  const place = placements.get(block.id) ?? { column: 0, columns: 1 };
                  const widthPct = 100 / place.columns;
                  const isShort = block.durationMinutes <= 30;
                  return (
                    <div
                      key={block.id}
                      className={`wtg-block wtg-block-${block.kind} ${
                        block.completed ? "is-done" : ""
                      } ${isShort ? "is-short" : ""}`}
                      style={{
                        top: block.startMinute * PX_PER_MINUTE,
                        height: Math.max(block.durationMinutes * PX_PER_MINUTE, 14),
                        left: `calc(${place.column * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      draggable
                      onDragStart={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        startDrag(e, {
                          source: "block",
                          blockId: block.id,
                          grabOffsetMinutes: (e.clientY - rect.top) / PX_PER_MINUTE,
                        });
                      }}
                    >
                      <div className="wtg-block-head">
                        <button
                          type="button"
                          className={`wtg-block-check ${block.completed ? "checked" : ""}`}
                          disabled={block.sessionBacked}
                          title={
                            block.sessionBacked
                              ? "Log a session to complete this habit"
                              : block.completed
                                ? "Mark incomplete"
                                : "Mark complete"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!block.sessionBacked) void toggleBlock(block);
                          }}
                        >
                          {block.completed ? "✓" : ""}
                        </button>
                        <span className="wtg-block-title">{block.title}</span>
                        <button
                          type="button"
                          className="wtg-block-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeBlock(block);
                          }}
                          aria-label={`Unschedule ${block.title}`}
                          title={block.kind === "temp" ? "Delete block" : "Unschedule"}
                        >
                          {block.kind === "temp" ? <Trash2 size={10} /> : <X size={11} />}
                        </button>
                      </div>
                      {!isShort && (
                        <span className="wtg-block-time">
                          {formatTime(block.startMinute)} – {formatTime(block.startMinute + block.durationMinutes)}
                        </span>
                      )}
                      <div
                        className="wtg-block-resize"
                        onPointerDown={(e) => startResize(e, block)}
                        title="Drag to change duration"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
