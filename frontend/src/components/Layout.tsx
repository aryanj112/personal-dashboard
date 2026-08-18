import { AnimatePresence, motion } from "framer-motion";
import {
  Dumbbell,
  FileBadge2,
  LayoutGrid,
  ListTodo,
  Music4,
  Network,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  {
    value: "dashboard",
    label: "Overview",
    detail: "Patterns, streaks, and pacing",
    icon: LayoutGrid,
  },
  {
    value: "today",
    label: "Tasks",
    detail: "Habits, tasks, and live focus",
    icon: ListTodo,
  },
  {
    value: "guitar",
    label: "Guitar",
    detail: "Practice notes and section mix",
    icon: Music4,
  },
  {
    value: "workouts",
    label: "Workouts",
    detail: "Sessions, runs, and volume",
    icon: Dumbbell,
  },
  {
    value: "networking",
    label: "Networking",
    detail: "People, follow-ups, and opportunities",
    icon: Network,
  },
  {
    value: "resume",
    label: "Resume",
    detail: "Tailor LaTeX source and export PDFs",
    icon: FileBadge2,
  },
  {
    value: "settings",
    label: "Settings",
    detail: "Theme, material, and dashboard controls",
    icon: Settings,
  },
] as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.value !== "settings");
const SETTINGS_NAV_ITEM = NAV_ITEMS.find((item) => item.value === "settings");

export function Layout({
  route,
  onNavigate,
  children,
}: {
  route: string;
  onNavigate: (route: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient-grid" />

      <header className="topbar">
        <div className="topbar-spacer" aria-hidden="true" />

        <nav className="topbar-nav" aria-label="Primary navigation">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = route === item.value;
            return (
              <button
                key={item.value}
                className={`topbar-link ${active ? "active" : ""}`}
                onClick={() => onNavigate(item.value)}
              >
                <span className="topbar-link-icon">
                  <Icon size={18} />
                </span>
                <span className="topbar-link-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {SETTINGS_NAV_ITEM ? (
          <button
            className={`topbar-link topbar-link-settings ${route === SETTINGS_NAV_ITEM.value ? "active" : ""}`}
            onClick={() => onNavigate(SETTINGS_NAV_ITEM.value)}
          >
            <span className="topbar-link-icon">
              <SETTINGS_NAV_ITEM.icon size={18} />
            </span>
            <span className="topbar-link-label">{SETTINGS_NAV_ITEM.label}</span>
          </button>
        ) : null}
      </header>

      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            className="page-frame"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
