import type {
  Company,
  DashboardResponse,
  Goal,
  GuitarMaterial,
  QuickLink,
  GuitarResponse,
  GuitarSong,
  GuitarSongFile,
  RecurringTask,
  ModuleResponse,
  Session,
  Task,
  TaskPriority,
  TodayResponse,
  WeekResponse,
} from "./types";
import type { NetworkingContact } from "./networking";
import type { PotentialConnect } from "./networking";

export const API_BASE = "http://127.0.0.1:8000";

async function getErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        return payload.detail;
      }
    } catch {
      // Fall through to raw text if the response body wasn't valid JSON.
    }
  }

  const detail = await response.text();
  return detail || `Request failed: ${response.status}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await getErrorDetail(response));
  }
  return response.json() as Promise<T>;
}

export const api = {
  getToday(date?: string) {
    const query = date ? `?target_date=${date}` : "";
    return request<TodayResponse>(`/api/today${query}`);
  },
  getDashboard() {
    return request<DashboardResponse>("/api/dashboard");
  },
  logHabit(habitId: number, completed: boolean, date: string) {
    return request(`/api/habits/${habitId}/log`, {
      method: "PUT",
      body: JSON.stringify({ date, completed }),
    });
  },
  setSickDay(isSick: boolean, date: string) {
    return request(`/api/habits/sick-day`, {
      method: "PUT",
      body: JSON.stringify({ date, is_sick: isSick }),
    });
  },
  getWeek(weekStart?: string) {
    const query = weekStart ? `?week_start=${weekStart}` : "";
    return request<WeekResponse>(`/api/tasks/week${query}`);
  },
  createTask(text: string, options: { date?: string; priority?: TaskPriority; is_misc?: boolean; url?: string } = {}) {
    return request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        text,
        date: options.date ?? null,
        priority: options.priority ?? "medium",
        is_misc: options.is_misc ?? false,
        url: options.url ?? "",
      }),
    });
  },
  createChecklist(payload: {
    text: string;
    startingCount: number;
    totalGoal: number;
    dailyGoal: number;
  }) {
    return request<TodayResponse["checklists"][number]>("/api/tasks/checklists", {
      method: "POST",
      body: JSON.stringify({
        text: payload.text,
        starting_count: payload.startingCount,
        total_goal: payload.totalGoal,
        daily_goal: payload.dailyGoal,
      }),
    });
  },
  updateChecklistProgress(checklistId: number, date: string, delta: number) {
    return request<TodayResponse["checklists"][number]>(`/api/tasks/checklists/${checklistId}/progress`, {
      method: "POST",
      body: JSON.stringify({ date, delta }),
    });
  },
  addChecklistTask(checklistId: number, date: string) {
    return request<Task>(`/api/tasks/checklists/${checklistId}/task`, {
      method: "POST",
      body: JSON.stringify({ date, delta: 0 }),
    });
  },
  deleteChecklist(checklistId: number) {
    return request<{ ok: boolean }>(`/api/tasks/checklists/${checklistId}`, {
      method: "DELETE",
    });
  },
  updateTask(taskId: number, patch: Partial<Task> & { date?: string | null }) {
    return request<Task>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteTask(taskId: number) {
    return request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });
  },
  createGoal(text: string) {
    return request<Goal>("/api/tasks/goals", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  deleteGoal(goalId: number) {
    return request<{ ok: boolean }>(`/api/tasks/goals/${goalId}`, {
      method: "DELETE",
    });
  },
  getGuitar() {
    return request<GuitarResponse>("/api/guitar");
  },
  getWorkouts() {
    return request<ModuleResponse>("/api/workouts");
  },
  createSection(kind: "guitar" | "workouts", name: string) {
    return request(`${kind === "guitar" ? "/api/guitar" : "/api/workouts"}/sections`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  updateSection(kind: "guitar" | "workouts", sectionId: number, name: string) {
    return request(`${kind === "guitar" ? "/api/guitar" : "/api/workouts"}/sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },
  deleteSection(kind: "guitar" | "workouts", sectionId: number) {
    return request<{ ok: boolean }>(
      `${kind === "guitar" ? "/api/guitar" : "/api/workouts"}/sections/${sectionId}`,
      {
        method: "DELETE",
      },
    );
  },
  createSession(
    kind: "guitar" | "workouts",
    payload: {
      date: string;
      duration_minutes?: number;
      run_miles?: number | null;
      notes?: string;
      section_ids: number[];
      is_rest?: boolean;
    },
  ) {
    return request<Session>(`${kind === "guitar" ? "/api/guitar" : "/api/workouts"}/sessions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateSession(
    kind: "guitar" | "workouts",
    sessionId: number,
    payload: {
      date?: string;
      duration_minutes?: number;
      run_miles?: number | null;
      notes?: string;
      section_ids?: number[];
      is_rest?: boolean;
    },
  ) {
    return request<Session>(`${kind === "guitar" ? "/api/guitar" : "/api/workouts"}/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteSession(kind: "guitar" | "workouts", sessionId: number) {
    return request<{ ok: boolean }>(`${kind === "guitar" ? "/api/guitar" : "/api/workouts"}/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },
  createGuitarMaterial(title: string, notes = "") {
    return request<GuitarMaterial>("/api/guitar/materials", {
      method: "POST",
      body: JSON.stringify({ title, notes }),
    });
  },
  updateGuitarMaterial(materialId: number, patch: { title?: string; notes?: string }) {
    return request<GuitarMaterial>(`/api/guitar/materials/${materialId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteGuitarMaterial(materialId: number) {
    return request<{ ok: boolean }>(`/api/guitar/materials/${materialId}`, {
      method: "DELETE",
    });
  },
  createGuitarSong(groupId: number, title: string) {
    return request<GuitarSong>(`/api/guitar/song-groups/${groupId}/songs`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },
  reorderGuitarSongs(groupId: number, songIds: number[]) {
    return request<{ ok: boolean }>(`/api/guitar/song-groups/${groupId}/songs/order`, {
      method: "PUT",
      body: JSON.stringify({ song_ids: songIds }),
    });
  },
  updateGuitarSong(songId: number, patch: { title?: string; notes?: string }) {
    return request<GuitarSong>(`/api/guitar/songs/${songId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteGuitarSong(songId: number) {
    return request<{ ok: boolean }>(`/api/guitar/songs/${songId}`, {
      method: "DELETE",
    });
  },
  async uploadGuitarSongFile(songId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/api/guitar/songs/${songId}/files`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<GuitarSongFile>;
  },
  deleteGuitarSongFile(fileId: number) {
    return request<{ ok: boolean }>(`/api/guitar/song-files/${fileId}`, {
      method: "DELETE",
    });
  },
  getNetworking() {
    return request<{ contacts: NetworkingContact[] }>("/api/networking");
  },
  getPotentialConnects() {
    return request<{ potentialConnects: PotentialConnect[] }>("/api/networking/potential-connects");
  },
  async compileResumePdf(name: string, source: string, signal?: AbortSignal) {
    const response = await fetch(`${API_BASE}/api/resume/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, source }),
      signal,
    });
    if (!response.ok) {
      throw new Error(await getErrorDetail(response));
    }
    return response.blob();
  },
  createNetworkingContact(payload: Omit<NetworkingContact, "id" | "isOverdue" | "createdAt" | "updatedAt">) {
    return request<NetworkingContact>("/api/networking", {
      method: "POST",
      body: JSON.stringify(toNetworkingPayload(payload)),
    });
  },
  updateNetworkingContact(
    contactId: number,
    payload: Omit<NetworkingContact, "id" | "isOverdue" | "createdAt" | "updatedAt">,
  ) {
    return request<NetworkingContact>(`/api/networking/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(toNetworkingPayload(payload)),
    });
  },
  deleteNetworkingContact(contactId: number) {
    return request<{ ok: boolean }>(`/api/networking/${contactId}`, {
      method: "DELETE",
    });
  },
  updatePotentialConnect(
    connectId: number,
    payload: {
      company?: string;
      connectionRequest?: string;
      status?: PotentialConnect["status"];
      dateSent?: string | null;
      notes?: string;
    },
  ) {
    return request<PotentialConnect>(`/api/networking/potential-connects/${connectId}`, {
      method: "PATCH",
      body: JSON.stringify({
        company: payload.company,
        connection_request: payload.connectionRequest,
        status: payload.status,
        date_sent: payload.dateSent,
        notes: payload.notes,
      }),
    });
  },
  deletePotentialConnect(connectId: number) {
    return request<{ ok: boolean }>(`/api/networking/potential-connects/${connectId}`, {
      method: "DELETE",
    });
  },
  getCompanies() {
    return request<{ companies: Company[] }>("/api/companies");
  },
  getCompaniesCoworkText() {
    return request<{ content: string }>("/api/companies/cowork-text");
  },
  createCompany(payload: {
    name: string;
    category: string;
    careersUrl?: string;
    sourceType?: string;
    sourceKey?: string;
  }) {
    return request<Company>("/api/companies", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        category: payload.category,
        careers_url: payload.careersUrl ?? "",
        source_type: payload.sourceType ?? "none",
        source_key: payload.sourceKey ?? "",
      }),
    });
  },
  updateCompany(
    companyId: number,
    patch: { name?: string; category?: string; careersUrl?: string; isActive?: boolean },
  ) {
    return request<Company>(`/api/companies/${companyId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.careersUrl !== undefined ? { careers_url: patch.careersUrl } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
      }),
    });
  },
  deleteCompany(companyId: number) {
    return request<{ ok: boolean }>(`/api/companies/${companyId}`, {
      method: "DELETE",
    });
  },

  getHabits() {
    return request<Array<{ id: number; name: string; is_active: boolean; sort_order: number }>>("/api/habits");
  },
  createHabit(name: string) {
    return request<{ id: number; name: string; is_active: boolean; sort_order: number }>("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },
  deleteHabit(habitId: number) {
    return request<void>(`/api/habits/${habitId}`, { method: "DELETE" });
  },
  updateHabit(habitId: number, payload: { name?: string; sort_order?: number; is_active?: boolean }) {
    return request<{ id: number; name: string; is_active: boolean; sort_order: number }>(`/api/habits/${habitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  // ── Recurring tasks ────────────────────────────────────────────────────────
  getRecurringTasks() {
    return request<RecurringTask[]>("/api/tasks/recurring");
  },
  createRecurringTask(payload: {
    text: string;
    priority: TaskPriority;
    days_of_week: number[];
    end_date?: string | null;
  }) {
    return request<RecurringTask>("/api/tasks/recurring", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateRecurringTask(
    id: number,
    patch: {
      text?: string;
      priority?: TaskPriority;
      days_of_week?: number[];
      end_date?: string | null;
      is_active?: boolean;
    },
  ) {
    return request<RecurringTask>(`/api/tasks/recurring/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteRecurringTask(id: number) {
    return request<{ ok: boolean }>(`/api/tasks/recurring/${id}`, {
      method: "DELETE",
    });
  },

  // ── Notes ──────────────────────────────────────────────────────────────────
  getNotes() {
    return request<{ content: string; updated_at: string }>("/api/notes");
  },
  saveNotes(content: string) {
    return request<{ content: string; updated_at: string }>("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  },
  getLinks() {
    return request<QuickLink[]>("/api/links");
  },
  createLink(label: string, url: string) {
    return request<QuickLink>("/api/links", {
      method: "POST",
      body: JSON.stringify({ label, url }),
    });
  },
  deleteLink(id: number) {
    return request<{ ok: boolean }>(`/api/links/${id}`, { method: "DELETE" });
  },
};

function toNetworkingPayload(
  payload: Omit<NetworkingContact, "id" | "isOverdue" | "createdAt" | "updatedAt">,
) {
  return {
    name: payload.name,
    company: payload.company,
    role: payload.role,
    tags: payload.tags,
    email: payload.email,
    phone: payload.phone,
    linkedin: payload.linkedin,
    location: payload.location,
    notes: payload.notes,
    last_contact_date: payload.lastContactDate,
    next_follow_up_date: payload.nextFollowUpDate || null,
    how_we_met: payload.howWeMet,
    next_action: payload.nextAction,
    follow_up_type: payload.followUpType || null,
    interactions: payload.interactions.map((interaction) => ({
      date: interaction.date,
      type: interaction.type,
      summary: interaction.summary,
    })),
  };
}
