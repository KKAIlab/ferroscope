// Display-date fixture (P0-A).
//
// The ingestion parser is timezone-invariant, but the display layer could undo that in one
// line. `new Date("2025-12-04")` is UTC midnight, so `Intl.DateTimeFormat` renders it as
// 03 Dec in any negative UTC offset. The stored date is a calendar date in the publisher's
// own frame and must read the same to every reader.
//
// This fixture renders the real interface — app.js through the DOM harness, not a copy of
// its formatter — once per timezone, and asserts that the visible day is identical. It also
// records what the previous `new Date()` path would have produced in each zone, so the
// fixture proves it still has power instead of passing vacuously.

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DomHarness } from "./lib/dom-harness.mjs";
import { formatCalendarDate } from "../lib/records.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "app.js");

// The record the independent review named: PubMed reports 2025-12-04, and a negative UTC
// offset is where the old formatter lost the day.
const PROBE_DATE = "2025-12-04";
const EXPECTED = "04 Dec 2025";
const ZONES = ["UTC", "Asia/Tokyo", "America/Los_Angeles"];
const ambient = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const zones = ZONES.includes(ambient) ? ZONES : [...ZONES, ambient];

const errors = [];
const fail = (condition, message) => { if (!condition) errors.push(message); };

// What the display layer used to do, kept here as the counterfactual rather than as code
// anything still calls.
function naiveFormat(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "invalid";
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(value);
}

async function renderIn(timeZone, cacheKey) {
  process.env.TZ = timeZone;
  const harness = new DomHarness({ dataRoot: root }).install();
  const url = pathToFileURL(appPath);
  url.search = `?dates=${cacheKey}`;
  const app = await import(url.href);
  await app.ready;
  app.state.visibleSignals = app.state.signals.length;
  app.renderSignals();
  harness.uninstall();
  return harness;
}

const rendered = new Map();
const naive = new Map();

for (const [index, timeZone] of zones.entries()) {
  const harness = await renderIn(timeZone, `tz${index}`);
  const html = harness.htmlFor("#signalList", "#frontierGrid");
  // The rendered signal carries the stored date in a machine-readable attribute and the
  // formatted date next to it, so the visible text can be pulled out of the real markup.
  const match = html.match(new RegExp(`<time datetime="${PROBE_DATE}">([^<]+)</time>`));
  fail(Boolean(match), `No record dated ${PROBE_DATE} was rendered under TZ=${timeZone}; the display-date fixture proves nothing.`);
  rendered.set(timeZone, match?.[1] ?? null);
  naive.set(timeZone, naiveFormat(PROBE_DATE));
}

process.env.TZ = ambient;

for (const [timeZone, visible] of rendered) {
  fail(visible === EXPECTED, `Under TZ=${timeZone} the interface rendered ${PROBE_DATE} as "${visible}" instead of "${EXPECTED}".`);
}
const distinct = new Set([...rendered.values()]);
fail(distinct.size === 1, `The same calendar date rendered differently across timezones: ${[...rendered].map(([zone, value]) => `${zone}=${value}`).join(", ")}.`);

// The pure formatter is checked directly as well, because the renderer could stop calling it.
for (const [value, expected] of [[PROBE_DATE, EXPECTED], ["2026-01-08", "08 Jan 2026"], ["2026-07-23T14:09:58.415Z", "23 Jul 2026"]]) {
  fail(formatCalendarDate(value) === expected, `formatCalendarDate("${value}") returned "${formatCalendarDate(value)}" instead of "${expected}".`);
}
for (const value of ["", null, undefined, "not a date", "2025-13-04", "2025-12"]) {
  fail(formatCalendarDate(value) === null, `formatCalendarDate(${JSON.stringify(value)}) invented a date instead of returning null.`);
}

// If the old path agreed with the new one in every timezone tested, this fixture would be
// passing for the wrong reason.
const naiveDistinct = new Set([...naive.values()]);
fail(naiveDistinct.size > 1, `The previous new Date() formatter rendered ${PROBE_DATE} identically in every timezone tested, so this fixture would not have caught the defect it exists for.`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const drifted = [...naive].filter(([, value]) => value !== EXPECTED).map(([zone, value]) => `${zone} would have shown ${value}`);
console.log(
  `Display-date fixture passed in ${zones.length} timezones (${zones.join(", ")}): ` +
    `${PROBE_DATE} renders as "${EXPECTED}" in all of them. The previous new Date() formatter — ${drifted.join("; ") || "no drift observed here"}.`,
);
