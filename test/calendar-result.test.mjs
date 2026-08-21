import assert from "node:assert/strict";
import test from "node:test";
import {
  CALENDAR_AUTHORIZATION_INSTRUCTIONS,
  classifyCalendarAuthorization,
  parseCalendarResult,
} from "../src/calendar-result.ts";

test("provides the exact macOS Calendar authorization path", () => {
  assert.equal(
    CALENDAR_AUTHORIZATION_INSTRUCTIONS,
    "授权步骤：打开“系统设置 → 隐私与安全性 → 日历”，勾选 Obsidian，然后重启 Obsidian。",
  );
});

test("classifies every documented EventKit authorization status", () => {
  assert.equal(classifyCalendarAuthorization(0), "unavailable");
  assert.equal(classifyCalendarAuthorization(1), "unavailable");
  assert.equal(classifyCalendarAuthorization(2), "denied");
  assert.equal(classifyCalendarAuthorization(3), "full-access");
  assert.equal(classifyCalendarAuthorization(4), "unavailable");
});

test("does not guess authorization for unknown or incorrectly typed statuses", () => {
  assert.equal(classifyCalendarAuthorization(5), "unavailable");
  assert.equal(classifyCalendarAuthorization("2"), "unavailable");
  assert.equal(classifyCalendarAuthorization(null), "unavailable");
  assert.equal(classifyCalendarAuthorization(undefined), "unavailable");
});

test("reports EventKit denied status 2 as denied", () => {
  assert.deepEqual(
    parseCalendarResult(JSON.stringify({ authorizationStatus: 2, events: {}, calendars: [] })),
    { authorization: "denied", events: {}, calendars: [] },
  );
});

test("does not expose calendar data when access is denied", () => {
  assert.deepEqual(
    parseCalendarResult(
      JSON.stringify({
        authorizationStatus: 2,
        calendars: ["Private"],
        events: { Private: [{ id: "private", title: "Private event" }] },
      }),
    ),
    { authorization: "denied", events: {}, calendars: [] },
  );
});

test("keeps non-readable statuses distinct from an authorized empty calendar", () => {
  for (const authorizationStatus of [0, 1, 4, 5]) {
    assert.deepEqual(
      parseCalendarResult(JSON.stringify({ authorizationStatus, events: {}, calendars: [] })),
      { authorization: "unavailable", events: {}, calendars: [] },
    );
  }

  assert.deepEqual(
    parseCalendarResult(JSON.stringify({ authorizationStatus: 3, events: {}, calendars: [] })),
    { authorization: "full-access", events: {}, calendars: [] },
  );
});

test("maps valid events when full Calendar access is granted", () => {
  const result = parseCalendarResult(
    JSON.stringify({
      authorizationStatus: 3,
      calendars: ["Work", "Personal"],
      events: {
        Work: [
          {
            id: "event-1",
            title: "Review",
            start: "2026-08-21T09:00:00.000Z",
            end: "2026-08-21T10:00:00.000Z",
            allDay: false,
            location: "Meeting room",
            notes: "Agenda",
          },
        ],
      },
    }),
  );

  assert.deepEqual(result, {
    authorization: "full-access",
    calendars: ["Work", "Personal"],
    events: {
      Work: [
        {
          id: "event-1",
          title: "Review",
          calendar: "Work",
          start: "2026-08-21T09:00:00.000Z",
          end: "2026-08-21T10:00:00.000Z",
          allDay: false,
          location: "Meeting room",
          notes: "Agenda",
        },
      ],
    },
  });
});

test("filters malformed calendars and events without discarding valid events", () => {
  const result = parseCalendarResult(
    JSON.stringify({
      authorizationStatus: 3,
      calendars: ["Work", 123, null],
      events: {
        Work: [
          null,
          { id: 1, title: "Invalid" },
          {
            id: "valid",
            title: "Valid",
            start: "2026-08-21T09:00:00.000Z",
            end: "2026-08-21T10:00:00.000Z",
            allDay: true,
            location: false,
            notes: 123,
          },
        ],
        InvalidGroup: "not-an-array",
      },
    }),
  );

  assert.deepEqual(result, {
    authorization: "full-access",
    calendars: ["Work"],
    events: {
      Work: [
        {
          id: "valid",
          title: "Valid",
          calendar: "Work",
          start: "2026-08-21T09:00:00.000Z",
          end: "2026-08-21T10:00:00.000Z",
          allDay: true,
          location: undefined,
          notes: undefined,
        },
      ],
    },
  });
});

test("reports missing or malformed responses as unavailable", () => {
  const invalidOutputs = [
    null,
    "",
    "not-json",
    "[]",
    "null",
    JSON.stringify({}),
    JSON.stringify({ authorizationStatus: 3 }),
    JSON.stringify({ authorizationStatus: 3, events: [], calendars: [] }),
    JSON.stringify({ authorizationStatus: 3, events: {}, calendars: {} }),
    JSON.stringify({ authorizationStatus: "3", events: {}, calendars: [] }),
  ];

  for (const output of invalidOutputs) {
    assert.deepEqual(parseCalendarResult(output), {
      authorization: "unavailable",
      events: {},
      calendars: [],
    });
  }
});
