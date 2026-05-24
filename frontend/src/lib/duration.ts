export const DEFAULT_RUN_DURATION_MINUTES = 8.25;
export const DEFAULT_RUN_DURATION_INPUT = "8:15";

export function combineDurationParts(minutes: number, seconds: number) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const totalSeconds = safeMinutes * 60 + safeSeconds;
  return totalSeconds / 60;
}

export function splitDurationMinutes(value: number) {
  const totalSeconds = Math.max(0, Math.round((value || 0) * 60));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatDurationMinutes(value: number) {
  const { minutes, seconds } = splitDurationMinutes(value);
  if (seconds === 0) {
    return `${minutes} min`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDurationInput(value: number) {
  const { minutes, seconds } = splitDurationMinutes(value);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function parseDurationInput(value: string, fallback = DEFAULT_RUN_DURATION_MINUTES) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.includes(":")) {
    const [minutesPart = "0", secondsPart = "0"] = trimmed.split(":");
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return fallback;
    }
    return combineDurationParts(minutes, seconds);
  }

  const numericMinutes = Number(trimmed);
  return Number.isFinite(numericMinutes) ? Math.max(0, numericMinutes) : fallback;
}
