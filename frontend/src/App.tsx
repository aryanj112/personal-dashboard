import { motion } from "framer-motion";
import { startTransition, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { api } from "./lib/api";
import {
  DEFAULT_NETWORKING_OPTIONS,
  type NetworkingOptionConfig,
} from "./lib/networking";
import type {
  DashboardResponse,
  GuitarResponse,
  ModuleResponse,
  TodayResponse,
} from "./lib/types";
import { DashboardPage } from "./pages/DashboardPage";
import { GuitarPage } from "./pages/GuitarPage";
import { ModulePage } from "./pages/ModulePage";
import { NetworkingPage } from "./pages/NetworkingPage";
import { ResumePage } from "./pages/ResumePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";

type Route =
  | "dashboard"
  | "today"
  | "guitar"
  | "workouts"
  | "networking"
  | "resume"
  | "settings";
type ColorTheme = "light" | "dark";
type SurfaceMood = "studio" | "industrial";
type DashboardPreferences = {
  show_dashboard_refresh: boolean;
  show_open_today: boolean;
  show_export_today: boolean;
  show_notes: boolean;
  show_resume: boolean;
};

const DEFAULT_ROUTE: Route = "dashboard";
const DEFAULT_THEME: ColorTheme = "dark";
const DEFAULT_MOOD: SurfaceMood = "studio";
const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  show_dashboard_refresh: false,
  show_open_today: true,
  show_export_today: true,
  show_notes: false,
  show_resume: false,
};
const ROUTE_STORAGE_KEY = "personal-route";
const THEME_STORAGE_KEY = "personal-theme";
const MOOD_STORAGE_KEY = "personal-mood";
const TIME_ZONE_STORAGE_KEY = "personal-time-zone";
const DASHBOARD_PREFERENCES_STORAGE_KEY = "personal-dashboard-preferences";
const NETWORKING_OPTIONS_STORAGE_KEY = "personal-networking-options";

export default function App() {
  const [tasksDate, setTasksDate] = useState(() => getTodayString());
  const [route, setRoute] = useState<Route>(() => getStoredValue(ROUTE_STORAGE_KEY, DEFAULT_ROUTE));
  const [theme, setTheme] = useState<ColorTheme>(() => getStoredValue(THEME_STORAGE_KEY, DEFAULT_THEME));
  const [mood, setMood] = useState<SurfaceMood>(() => getStoredValue(MOOD_STORAGE_KEY, DEFAULT_MOOD));
  const [timeZone, setTimeZone] = useState<string>(() =>
    getStoredValue(TIME_ZONE_STORAGE_KEY, getDefaultTimeZone()),
  );
  const [dashboardPreferences, setDashboardPreferences] = useState<DashboardPreferences>(() =>
    getStoredObject(DASHBOARD_PREFERENCES_STORAGE_KEY, DEFAULT_DASHBOARD_PREFERENCES),
  );
  const [networkingOptions, setNetworkingOptions] = useState<NetworkingOptionConfig>(() =>
    getStoredObject(NETWORKING_OPTIONS_STORAGE_KEY, DEFAULT_NETWORKING_OPTIONS),
  );
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [guitar, setGuitar] = useState<GuitarResponse | null>(null);
  const [workouts, setWorkouts] = useState<ModuleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll(targetDate = tasksDate) {
    try {
      if (today === null || dashboard === null || guitar === null || workouts === null) {
        setLoading(true);
      }
      const [todayData, dashboardData, guitarData, workoutData] = await Promise.all([
        api.getToday(targetDate),
        api.getDashboard(),
        api.getGuitar(),
        api.getWorkouts(),
      ]);
      setToday(todayData);
      setDashboard(dashboardData);
      setGuitar(guitarData);
      setWorkouts(workoutData);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(tasksDate);
  }, [tasksDate]);

  useEffect(() => {
    window.localStorage.setItem(ROUTE_STORAGE_KEY, route);
  }, [route]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(MOOD_STORAGE_KEY, mood);
    document.documentElement.dataset.mood = mood;
  }, [mood]);

  useEffect(() => {
    window.localStorage.setItem(TIME_ZONE_STORAGE_KEY, timeZone);
  }, [timeZone]);

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_PREFERENCES_STORAGE_KEY,
      JSON.stringify(dashboardPreferences),
    );
  }, [dashboardPreferences]);

  useEffect(() => {
    window.localStorage.setItem(NETWORKING_OPTIONS_STORAGE_KEY, JSON.stringify(networkingOptions));
  }, [networkingOptions]);

  function navigate(nextRoute: string) {
    startTransition(() => {
      setRoute(nextRoute as Route);
    });
  }

  // Redirect away from resume if it gets hidden
  useEffect(() => {
    if (route === "resume" && !dashboardPreferences.show_resume) {
      navigate("dashboard");
    }
  }, [dashboardPreferences.show_resume, route]);

  function openTasksForToday() {
    setTasksDate(getTodayString());
    navigate("today");
  }

  const content = route === "resume" && dashboardPreferences.show_resume ? (
    <ResumePage />
  ) : loading ? (
    <div className="empty-state shell-state">
      <h2>Loading your studio.</h2>
    </div>
  ) : error ? (
    <div className="empty-state shell-state error-state">
      <p className="eyebrow">Connection issue</p>
      <h2>Can&apos;t reach your local API.</h2>
      <p>{error}</p>
      <button className="secondary-button" onClick={() => void loadAll()}>
        Retry
      </button>
    </div>
  ) : route === "networking" ? (
    <NetworkingPage options={networkingOptions} />
  ) : route === "today" && today ? (
    <TodayPage
      data={today}
      guitar={guitar}
      workouts={workouts}
      selectedDate={tasksDate}
      onDateChange={setTasksDate}
      onRefresh={() => loadAll(tasksDate)}
      showNotes={dashboardPreferences.show_notes}
    />
  ) : route === "guitar" && guitar ? (
    <GuitarPage data={guitar} onRefresh={() => loadAll(tasksDate)} />
  ) : route === "workouts" && workouts ? (
    <ModulePage
      title="Workouts"
      kind="workouts"
      data={workouts}
      onRefresh={() => loadAll(tasksDate)}
    />
  ) : route === "settings" ? (
    <SettingsPage
      theme={theme}
      mood={mood}
      timeZone={timeZone}
      guitar={guitar}
      workouts={workouts}
      dashboardPreferences={dashboardPreferences}
      networkingOptions={networkingOptions}
      onThemeChange={setTheme}
      onMoodChange={setMood}
      onTimeZoneChange={setTimeZone}
      onDashboardPreferencesChange={setDashboardPreferences}
      onNetworkingOptionsChange={setNetworkingOptions}
      onRefresh={() => loadAll(tasksDate)}
    />
  ) : dashboard && today ? (
    <DashboardPage
      data={dashboard}
      today={today}
      guitar={guitar}
      workouts={workouts}
      preferences={dashboardPreferences}
      onNavigate={() => openTasksForToday()}
      onRefresh={() => loadAll(tasksDate)}
    />
  ) : null;

  return (
    <Layout
      route={route}
      onNavigate={navigate}
      showResume={dashboardPreferences.show_resume}
    >
      {content}
    </Layout>
  );
}

function getStoredValue<T extends string>(storageKey: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  const stored = window.localStorage.getItem(storageKey);
  return stored ? (stored as T) : fallback;
}

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

function getDefaultTimeZone() {
  if (typeof window === "undefined") {
    return "America/New_York";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}

function getStoredObject<T>(storageKey: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return fallback;
  }
  try {
    return { ...fallback, ...JSON.parse(stored) } as T;
  } catch {
    return fallback;
  }
}
