export type Habit = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  completed?: boolean;
  notes?: string | null;
  is_sick?: boolean;
};

export type TaskPriority = "high" | "medium" | "low";

export type Task = {
  id: number;
  text: string;
  task_date: string | null;
  completed: boolean;
  notes?: string | null;
  sort_order: number;
  checklist_id?: number | null;
  recurring_task_id?: number | null;
  priority: TaskPriority;
  is_misc: boolean;
  url?: string;
};

export type Checklist = {
  id: number;
  text: string;
  starting_count: number;
  current_count: number;
  total_goal: number;
  daily_goal: number;
  today_count: number;
  sort_order: number;
  task_id?: number | null;
  task_completed?: boolean;
};

export type TodayResponse = {
  date: string;
  habits: Habit[];
  tasks: Task[];
  checklists: Checklist[];
  overdue_tasks: Task[];
  goals: Goal[];
  misc_tasks: Task[];
};

export type WeekDay = {
  date: string;
  tasks: Task[];
};

export type WeekResponse = {
  start: string;
  end: string;
  days: WeekDay[];
  overdue_tasks: Task[];
  misc_tasks: Task[];
};

export type Goal = {
  id: number;
  text: string;
  created_at: string;
};

export type RecurringTask = {
  id: number;
  text: string;
  priority: TaskPriority;
  days_of_week: number[]; // 0=Mon … 6=Sun
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type Section = {
  id: number;
  name: string;
};

export type Session = {
  id: number;
  session_date: string;
  duration_minutes: number;
  run_miles?: number | null;
  notes?: string | null;
  is_rest?: boolean;
  sections: Section[];
};

export type AnalyticsPoint = {
  week_start?: string;
  date?: string;
  minutes: number;
};

export type DistributionPoint = {
  id: number;
  name: string;
  minutes: number;
};

export type ModuleResponse = {
  sections: Section[];
  sessions: Session[];
  sick_dates?: string[];
  analytics: {
    weekly_minutes: AnalyticsPoint[];
    rolling_average: AnalyticsPoint[];
    section_distribution: DistributionPoint[];
    days_this_week: number;
    current_streak: number;
    total_minutes: number;
    sessions_last_7_days: number;
  };
};

export type GuitarMaterial = {
  id: number;
  title: string;
  notes: string;
  sort_order: number;
};

export type GuitarSongFile = {
  id: number;
  display_name: string;
  relative_path: string;
  sort_order: number;
};

export type GuitarSong = {
  id: number;
  title: string;
  notes: string;
  sort_order: number;
  files: GuitarSongFile[];
};

export type GuitarSongGroup = {
  id: number;
  name: string;
  sort_order: number;
  songs: GuitarSong[];
};

export type GuitarResponse = ModuleResponse & {
  materials: GuitarMaterial[];
  song_groups: GuitarSongGroup[];
};

export type ActivityItem = {
  type: string;
  date: string;
  title: string;
  subtitle: string;
  notes?: string | null;
};

export type DashboardResponse = {
  today: {
    date: string;
    completed_habits: number;
    total_habits: number;
    open_tasks: number;
  };
  streaks: {
    habit_id: number;
    name: string;
    streak: number;
    last_completed_date?: string | null;
  }[];
  weekly_guitar_minutes: number;
  weekly_workouts: {
    count: number;
    minutes: number;
  };
  habit_heatmap: {
    date: string;
    count: number;
    habits: string[];
    sick_habits?: string[];
    total_habits?: number;
  }[];
  guitar: ModuleResponse["analytics"];
  workouts: ModuleResponse["analytics"];
  recent_activity: ActivityItem[];
};

export type Company = {
  id: number;
  name: string;
  sourceType: string;
  sourceKey: string;
  careersUrl: string;
  category: string;
  isActive: boolean;
};

export type QuickLink = {
  id: number;
  label: string;
  url: string;
  sort_order: number;
};
