import { startTransition, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { api } from "./lib/api";
import {
  DEFAULT_NETWORKING_OPTIONS,
  type NetworkingOptionConfig,
} from "./lib/networking";
import type {
  DashboardResponse,
  FinanceCategory,
  GuitarResponse,
  ModuleResponse,
  TodayResponse,
} from "./lib/types";
import { DashboardPage } from "./pages/DashboardPage";
import { FinancePage } from "./pages/FinancePage";
import { GuitarPage } from "./pages/GuitarPage";
import { InternshipsPage } from "./pages/InternshipsPage";
import { ModulePage } from "./pages/ModulePage";
import { NetworkingPage } from "./pages/NetworkingPage";
import { ReflectionPage } from "./pages/ReflectionPage";
import { ResumePage } from "./pages/ResumePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";

type Route =
  | "dashboard"
  | "today"
  | "guitar"
  | "workouts"
  | "networking"
  | "internships"
  | "resume"
  | "finance"
  | "reflection"
  | "settings";
type ColorTheme = "light" | "dark";
type SurfaceMood = "studio" | "industrial";
type DashboardPreferences = {
  show_dashboard_refresh: boolean;
  show_open_today: boolean;
  show_export_today: boolean;
  show_today_complete: boolean;
  show_guitar_cadence: boolean;
  show_training_rhythm: boolean;
  show_guitar_trend: boolean;
  show_training_trend: boolean;
  show_finance_page: boolean;
  show_reflection_page: boolean;
  show_notes: boolean;
};

const DEFAULT_ROUTE: Route = "dashboard";
const DEFAULT_THEME: ColorTheme = "dark";
const DEFAULT_MOOD: SurfaceMood = "studio";
const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  show_dashboard_refresh: false,
  show_open_today: true,
  show_export_today: true,
  show_today_complete: true,
  show_guitar_cadence: true,
  show_training_rhythm: true,
  show_guitar_trend: true,
  show_training_trend: true,
  show_finance_page: false,
  show_reflection_page: false,
  show_notes: false,
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
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll(targetDate = tasksDate) {
    try {
      if (today === null || dashboard === null || guitar === null || workouts === null) {
        setLoading(true);
      }
      const [todayData, dashboardData, guitarData, workoutData, financeCategoryData] = await Promise.all([
        api.getToday(targetDate),
        api.getDashboard(),
        api.getGuitar(),
        api.getWorkouts(),
        api.getFinanceCategories(),
      ]);
      setToday(todayData);
      setDashboard(dashboardData);
      setGuitar(guitarData);
      setWorkouts(workoutData);
      setFinanceCategories(financeCategoryData.categories);
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
    if (!dashboardPreferences.show_reflection_page && route === "reflection") {
      setRoute("dashboard");
      return;
    }
    if (!dashboardPreferences.show_finance_page && route === "finance") {
      setRoute("dashboard");
    }
  }, [dashboardPreferences.show_finance_page, dashboardPreferences.show_reflection_page, route]);

  useEffect(() => {
    window.localStorage.setItem(NETWORKING_OPTIONS_STORAGE_KEY, JSON.stringify(networkingOptions));
  }, [networkingOptions]);

  function navigate(nextRoute: string) {
    startTransition(() => {
      setRoute(nextRoute as Route);
    });
  }

  function openTasksForToday() {
    setTasksDate(getTodayString());
    navigate("today");
  }

  const content = route === "internships" ? (
    <InternshipsPage timeZone={timeZone} />
  ) : route === "resume" ? (
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
  ) : route === "finance" && dashboardPreferences.show_finance_page ? (
    <FinancePage categories={financeCategories} />
  ) : route === "reflection" ? (
    <ReflectionPage />
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
    <ModulePage title="Workouts" kind="workouts" data={workouts} onRefresh={() => loadAll(tasksDate)} />
  ) : route === "settings" ? (
    <SettingsPage
      theme={theme}
      mood={mood}
      timeZone={timeZone}
      guitar={guitar}
      workouts={workouts}
      financeCategories={financeCategories}
      dashboardPreferences={dashboardPreferences}
      networkingOptions={networkingOptions}
      onThemeChange={setTheme}
      onMoodChange={setMood}
      onTimeZoneChange={setTimeZone}
      onDashboardPreferencesChange={setDashboardPreferences}
      onNetworkingOptionsChange={setNetworkingOptions}
      onFinanceCategoriesChange={setFinanceCategories}
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
      showFinancePage={dashboardPreferences.show_finance_page}
      showReflectionPage={dashboardPreferences.show_reflection_page}
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
