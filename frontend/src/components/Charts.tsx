import { useState } from "react";

import type { AnalyticsPoint, DistributionPoint } from "../lib/types";

export function TinyBarChart({
  points,
  labelKey,
}: {
  points: AnalyticsPoint[];
  labelKey: "week_start" | "date";
}) {
  const max = Math.max(...points.map((point) => point.minutes), 1);

  return (
    <div className="tiny-bars">
      {points.map((point) => {
        const label = point[labelKey]?.slice(5) ?? "";
        return (
          <div key={point[labelKey]} className="tiny-bar-wrap" title={`${label}: ${point.minutes}`}>
            <div
              className="tiny-bar"
              style={{
                height: `${Math.max((point.minutes / max) * 100, point.minutes > 0 ? 12 : 3)}%`,
              }}
            />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TrendLine({ points }: { points: AnalyticsPoint[] }) {
  if (points.length === 0) {
    return <div className="chart-empty">No data yet</div>;
  }

  const max = Math.max(...points.map((point) => point.minutes), 1);
  const step = points.length > 1 ? 100 / (points.length - 1) : 100;
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = 100 - (point.minutes / max) * 100;
      return `${index === 0 ? "M" : "L"} ${x},${y}`;
    })
    .join(" ");

  return (
    <div className="trend-shell">
      <svg viewBox="0 0 100 100" className="trend-line" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trend-stroke" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-strong)" />
            <stop offset="100%" stopColor="var(--accent-soft)" />
          </linearGradient>
        </defs>
        <path d={path} />
        <path d={`${path} L 100,100 L 0,100 Z`} className="trend-area" />
      </svg>
    </div>
  );
}

export function WeeklyPieChart({
  items,
  totalValue,
  totalLabel = "this week",
  emptyLabel = "Nothing logged this week yet",
  totalFormatter,
}: {
  items: DistributionPoint[];
  totalValue?: number;
  totalLabel?: string;
  emptyLabel?: string;
  totalFormatter?: (value: number) => string;
}) {
  return (
    <DistributionPieChart
      items={items}
      totalLabel={totalLabel}
      emptyLabel={emptyLabel}
      totalValue={totalValue}
      totalFormatter={totalFormatter}
    />
  );
}

export function DistributionPieChart({
  items,
  totalLabel,
  emptyLabel,
  totalValue,
  totalFormatter,
}: {
  items: DistributionPoint[];
  totalLabel: string;
  emptyLabel: string;
  totalValue?: number;
  totalFormatter?: (value: number) => string;
}) {
  const activeItems = items.filter((item) => item.minutes > 0);
  const total = activeItems.reduce((sum, item) => sum + item.minutes, 0);
  const centerTotal = totalValue ?? total;
  const radius = 41;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return <div className="chart-empty">{emptyLabel}</div>;
  }

  let cursor = 0;
  const slices = activeItems.map((item, index) => {
    const percent = (item.minutes / total) * 100;
    const start = cursor;
    cursor += percent;
    return {
      ...item,
      percent,
      start,
      end: cursor,
      color: `var(--chart-${index % 6})`,
    };
  });

  return (
    <div className="pie-layout">
      <div className="pie-ring">
        <svg viewBox="0 0 100 100" className="pie-svg" aria-hidden="true">
          <circle className="pie-track" cx="50" cy="50" r={radius} />
          {slices.map((slice) => (
            <circle
              key={slice.id}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${(slice.percent / 100) * circumference} ${circumference}`}
              strokeDashoffset={`${-(slice.start / 100) * circumference}`}
              strokeLinecap="butt"
              className="pie-slice"
            />
          ))}
        </svg>
        <div className="pie-hole">
          <strong>
            {totalFormatter ? totalFormatter(centerTotal) : Math.round(centerTotal * 100) / 100}
          </strong>
          <span>{totalLabel}</span>
        </div>
      </div>
      <div className="legend-list">
        {slices.map((slice, index) => (
          <div key={slice.id} className="legend-item">
            <span className={`legend-dot color-${index % 6}`} />
            <span>{slice.name}</span>
            <strong>{Math.round(slice.percent)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({
  cells,
  totalHabits,
  variant,
}: {
  cells: {
    date: string;
    count: number;
    habits: string[];
    total_habits?: number;
  }[];
  totalHabits: number;
  variant: "aggregate" | "binary";
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const activeCell = cells.find((cell) => cell.date === activeDate) ?? null;

  return (
    <div className="heatmap-stack">
      <div className="heatmap">
        {cells.map((cell) => {
          const detail =
            cell.habits.length > 0
              ? `${cell.date}: ${cell.habits.join(", ")}`
              : `${cell.date}: no habits completed`;
          return (
            <button
              key={cell.date}
              type="button"
              className={`heat-cell ${
                variant === "binary"
                  ? cell.count > 0
                    ? "binary-complete"
                    : "binary-missed"
                  : `level-${Math.min(cell.count, 5)}`
              } ${
                activeDate === cell.date ? "active" : ""
              }`}
              title={detail}
              onMouseEnter={() => setActiveDate(cell.date)}
              onFocus={() => setActiveDate(cell.date)}
              onClick={() => setActiveDate((current) => (current === cell.date ? null : cell.date))}
            >
              {variant === "binary" && cell.count > 0 ? <span className="heat-cell-check">✓</span> : null}
            </button>
          );
        })}
      </div>
      <div className="heatmap-key" aria-label="Heatmap legend">
        {variant === "binary" ? (
          <>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch binary-complete" />
              Completed
            </span>
          </>
        ) : (
          <>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch level-0" />
              0
            </span>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch level-1" />
              1
            </span>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch level-2" />
              2
            </span>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch level-3" />
              3
            </span>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch level-4" />
              4
            </span>
            <span className="heatmap-key-item">
              <span className="heatmap-key-swatch level-5" />
              5+
            </span>
          </>
        )}
      </div>
      <div className="heatmap-detail" aria-live="polite">
        {activeCell ? (
          activeCell.habits.length > 0 ? (
            <>
              <strong>{activeCell.date}</strong>
              <span>{activeCell.count} / {activeCell.total_habits ?? totalHabits}</span>
              <span>{activeCell.habits.join(", ")}</span>
            </>
          ) : (
            <>
              <strong>{activeCell.date}</strong>
              <span>0 / {activeCell.total_habits ?? totalHabits}</span>
              <span>No habits completed</span>
            </>
          )
        ) : (
          <span>Hover or click a day to see which habits you completed.</span>
        )}
      </div>
    </div>
  );
}
