import type { CalendarEvent } from "./types";

export const CALENDAR_AUTHORIZATION_INSTRUCTIONS =
  "授权步骤：打开“系统设置 → 隐私与安全性 → 日历”，勾选 Obsidian，然后重启 Obsidian。";

export type CalendarAuthorization = "full-access" | "denied" | "unavailable";

export interface CalendarLoadResult {
  authorization: CalendarAuthorization;
  events: Record<string, CalendarEvent[]>;
  calendars: string[];
}

export function classifyCalendarAuthorization(status: unknown): CalendarAuthorization {
  if (status === 3) return "full-access";
  if (status === 2) return "denied";
  return "unavailable";
}

export function parseCalendarResult(output: string | null): CalendarLoadResult {
  if (!output) return unavailableResult();

  try {
    const parsed: unknown = JSON.parse(output);
    if (!isRecord(parsed)) return unavailableResult();

    const authorization = classifyCalendarAuthorization(parsed.authorizationStatus);
    if (authorization !== "full-access") {
      return { authorization, events: {}, calendars: [] };
    }
    if (!Array.isArray(parsed.calendars) || !isRecord(parsed.events)) {
      return unavailableResult();
    }

    const calendars = parsed.calendars.filter(
      (calendar): calendar is string => typeof calendar === "string",
    );
    const events: Record<string, CalendarEvent[]> = {};
    for (const [calendar, values] of Object.entries(parsed.events)) {
      if (!Array.isArray(values)) continue;
      events[calendar] = values.flatMap((value) => {
        const event = parseCalendarEvent(value, calendar);
        return event ? [event] : [];
      });
    }

    return { authorization, events, calendars };
  } catch {
    return unavailableResult();
  }
}

function unavailableResult(): CalendarLoadResult {
  return { authorization: "unavailable", events: {}, calendars: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCalendarEvent(value: unknown, calendar: string): CalendarEvent | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.start !== "string" ||
    typeof value.end !== "string" ||
    typeof value.allDay !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    calendar,
    start: value.start,
    end: value.end,
    allDay: value.allDay,
    location: typeof value.location === "string" ? value.location : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
  };
}
