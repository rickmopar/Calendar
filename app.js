const allEvents = window.CCCHR_EVENTS_2026 || [];
const metadata = window.CCCHR_METADATA || {};

const monthOrder = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const els = {
  search: document.querySelector("#searchInput"),
  currentDate: document.querySelector("#currentDate"),
  refreshDate: document.querySelector("#refreshDate"),
  monthFilter: document.querySelector("#monthFilter"),
  monthOptions: document.querySelector("#monthOptions"),
  monthSummary: document.querySelector("#monthSummary"),
  typeFilter: document.querySelector("#typeFilter"),
  typeOptions: document.querySelector("#typeOptions"),
  typeSummary: document.querySelector("#typeSummary"),
  cityFilter: document.querySelector("#cityFilter"),
  cityOptions: document.querySelector("#cityOptions"),
  citySummary: document.querySelector("#citySummary"),
  sourceFilter: document.querySelector("#sourceFilter"),
  sourceOptions: document.querySelector("#sourceOptions"),
  sourceSummary: document.querySelector("#sourceSummary"),
  dateRange: document.querySelector("#dateRangeSelect"),
  sort: document.querySelector("#sortSelect"),
  assistantInput: document.querySelector("#assistantInput"),
  assistantButton: document.querySelector("#assistantButton"),
  assistantResponse: document.querySelector("#assistantResponse"),
  manualForm: document.querySelector("#manualEventForm"),
  manualTitle: document.querySelector("#manualTitle"),
  manualDate: document.querySelector("#manualDate"),
  manualTime: document.querySelector("#manualTime"),
  manualCity: document.querySelector("#manualCity"),
  manualType: document.querySelector("#manualType"),
  manualVenue: document.querySelector("#manualVenue"),
  manualAddress: document.querySelector("#manualAddress"),
  manualDeadline: document.querySelector("#manualDeadline"),
  manualDescription: document.querySelector("#manualDescription"),
  syncUrl: document.querySelector("#syncUrl"),
  syncCode: document.querySelector("#syncCode"),
  saveSyncSettings: document.querySelector("#saveSyncSettings"),
  loadSyncData: document.querySelector("#loadSyncData"),
  saveSyncData: document.querySelector("#saveSyncData"),
  syncStatus: document.querySelector("#syncStatus"),
  exportPdf: document.querySelector("#exportPdfButton"),
  reset: document.querySelector("#resetButton"),
  total: document.querySelector("#totalEvents"),
  cities: document.querySelector("#activeCities"),
  topMonth: document.querySelector("#topMonth"),
  range: document.querySelector("#dateRange"),
  resultCount: document.querySelector("#resultCount"),
  chart: document.querySelector("#monthChart"),
  list: document.querySelector("#eventList"),
  interestedList: document.querySelector("#interestedList"),
  interestedCount: document.querySelector("#interestedCount"),
  deadlineList: document.querySelector("#deadlineList"),
  deadlineCount: document.querySelector("#deadlineCount"),
  insights: document.querySelector("#insightsList"),
};

function dateKey(date, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

const today = new Date();
const todayKey = dateKey(today);
const manualEventsStorageKey = "car-show-calendar-manual-events-v1";
const syncUrlStorageKey = "car-show-calendar-sync-url-v1";
const syncCodeStorageKey = "car-show-calendar-sync-code-v1";
let syncApplying = false;
let cloudSaveTimer = null;
let events = buildEvents();
const interestedStorageKey = "car-show-calendar-interested-v1";
const eventNotesStorageKey = "car-show-calendar-notes-v1";
let interestedIds = loadInterestedIds();
let eventNotes = loadEventNotes();

function buildEvents() {
  return [...allEvents, ...loadManualEvents()]
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function reloadEventsFromStorage() {
  events = buildEvents();
}

function isValidManualEvent(event) {
  return Boolean(
    event
    && typeof event.id === "string"
    && typeof event.title === "string"
    && typeof event.startDate === "string"
    && typeof event.endDate === "string"
    && !Number.isNaN(Date.parse(event.startDate))
    && !Number.isNaN(Date.parse(event.endDate)),
  );
}

function loadManualEvents() {
  try {
    const saved = JSON.parse(localStorage.getItem(manualEventsStorageKey) || "[]");
    return Array.isArray(saved) ? saved.filter(isValidManualEvent) : [];
  } catch {
    return [];
  }
}

function saveManualEvent(event) {
  const saved = loadManualEvents();
  saved.push(event);
  localStorage.setItem(manualEventsStorageKey, JSON.stringify(saved));
  requestCloudSave();
}

function manualDateLabel(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function deleteManualEvent(id) {
  const saved = loadManualEvents().filter((event) => event.id !== id);
  localStorage.setItem(manualEventsStorageKey, JSON.stringify(saved));
  interestedIds.delete(id);
  delete eventNotes[id];
  saveInterestedIds();
  saveEventNotes();
  await saveCloudAssistantState({ silent: true });
  window.location.search = "?fresh=26";
}

function manualDateToEventParts(dateValue, timeValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const hasTime = Boolean(timeValue);
  const [hour, minute] = hasTime ? timeValue.split(":").map(Number) : [9, 0];
  const start = hasTime
    ? new Date(year, month - 1, day, hour, minute)
    : new Date(Date.UTC(year, month - 1, day));
  const end = hasTime ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : start;
  const timeZone = hasTime ? "America/New_York" : "UTC";
  return { start, end, hasTime, timeZone };
}

function createManualEvent() {
  const title = els.manualTitle.value.trim();
  const dateValue = els.manualDate.value;
  const city = els.manualCity.value.trim();
  if (!title || !dateValue || !city) return null;

  const { start, end, hasTime, timeZone } = manualDateToEventParts(dateValue, els.manualTime.value);
  const deadline = manualDateLabel(els.manualDeadline.value);

  return {
    id: `manual-${Date.now()}`,
    title,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    allDay: !hasTime,
    month: start.toLocaleString("en-US", { month: "long", timeZone }),
    weekday: start.toLocaleString("en-US", { weekday: "short", timeZone }),
    dateLabel: start.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }),
    timeLabel: hasTime ? start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone }) : "All day",
    type: els.manualType.value,
    source: "Manual",
    city,
    venue: els.manualVenue.value.trim() || "Manual entry",
    address: els.manualAddress.value.trim(),
    description: els.manualDescription.value.trim(),
    sourceUrl: "",
    url: "",
    image: "",
    registrationDeadlineNote: deadline ? `Registration deadline: ${deadline}` : "",
  };
}

function loadInterestedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(interestedStorageKey) || "[]"));
  } catch {
    return new Set();
  }
}

function saveInterestedIds() {
  localStorage.setItem(interestedStorageKey, JSON.stringify([...interestedIds]));
  requestCloudSave();
}

function loadEventNotes() {
  try {
    return JSON.parse(localStorage.getItem(eventNotesStorageKey) || "{}");
  } catch {
    return {};
  }
}

function saveEventNotes() {
  localStorage.setItem(eventNotesStorageKey, JSON.stringify(eventNotes));
  requestCloudSave();
}

function noteForEvent(id) {
  return eventNotes[id] || "";
}

function normalizeSyncCode(value) {
  return String(value || "").trim().toLowerCase();
}

function loadSyncConfig() {
  return {
    url: localStorage.getItem(syncUrlStorageKey) || "",
    code: normalizeSyncCode(localStorage.getItem(syncCodeStorageKey) || ""),
  };
}

function syncConfigured(config = loadSyncConfig()) {
  return Boolean(config.url && config.code);
}

function setSyncStatus(message) {
  if (els.syncStatus) els.syncStatus.textContent = message;
}

function populateSyncControls() {
  const config = loadSyncConfig();
  if (els.syncUrl) els.syncUrl.value = config.url;
  if (els.syncCode) els.syncCode.value = config.code;
  setSyncStatus(syncConfigured(config) ? "Sync configured. Save or load when ready." : "Local only until sync is configured.");
}

function saveSyncSettings() {
  const url = els.syncUrl?.value.trim() || "";
  const code = normalizeSyncCode(els.syncCode?.value || "");
  if (els.syncCode) els.syncCode.value = code;
  localStorage.setItem(syncUrlStorageKey, url);
  localStorage.setItem(syncCodeStorageKey, code);
  setSyncStatus(syncConfigured({ url, code }) ? "Sync settings saved." : "Add both a Script URL and private code to sync.");
}

function assistantSyncPayload() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    interestedIds: [...interestedIds],
    eventNotes,
    manualEvents: loadManualEvents(),
  };
}

function replaceManualEvents(remoteManualEvents) {
  const cleanEvents = (Array.isArray(remoteManualEvents) ? remoteManualEvents : [])
    .filter(isValidManualEvent);
  localStorage.setItem(manualEventsStorageKey, JSON.stringify(cleanEvents));
}

function applyAssistantSyncPayload(payload) {
  if (!payload || typeof payload !== "object") return;

  syncApplying = true;
  try {
    replaceManualEvents(payload.manualEvents);
    interestedIds = new Set(Array.isArray(payload.interestedIds) ? payload.interestedIds : []);
    eventNotes = payload.eventNotes && typeof payload.eventNotes === "object" ? payload.eventNotes : {};
    saveInterestedIds();
    saveEventNotes();
    reloadEventsFromStorage();
    rebuildFilterValues();
    refreshFilterControls();
    render();
  } finally {
    syncApplying = false;
  }
}

function syncUrlWithParams(url, params) {
  const parsed = new URL(url);
  Object.entries(params).forEach(([key, value]) => parsed.searchParams.set(key, value));
  return parsed.toString();
}

function loadCloudAssistantState() {
  saveSyncSettings();
  const config = loadSyncConfig();
  if (!syncConfigured(config)) return Promise.resolve();

  setSyncStatus("Loading from Google Sheets...");
  return new Promise((resolve) => {
    const callbackName = `calendarSync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (response) => {
      cleanup();
      if (response?.ok && response.data) {
        applyAssistantSyncPayload(response.data);
        setSyncStatus(`Loaded from Sheets: ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`);
      } else if (response?.ok) {
        setSyncStatus("No saved Sheet data for this code yet.");
      } else {
        setSyncStatus(response?.error || "Could not load from Sheets.");
      }
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      setSyncStatus("Could not reach the Google Script URL.");
      resolve(null);
    };

    script.src = syncUrlWithParams(config.url, {
      action: "load",
      code: config.code,
      callback: callbackName,
    });
    document.body.appendChild(script);
  });
}

async function saveCloudAssistantState({ silent = false } = {}) {
  const config = loadSyncConfig();
  if (!syncConfigured(config)) return;
  if (!silent) setSyncStatus("Saving to Google Sheets...");

  try {
    await fetch(config.url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        code: config.code,
        device: navigator.userAgent || "Calendar browser",
        data: assistantSyncPayload(),
      }),
    });
    setSyncStatus(`Save sent to Sheets: ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`);
  } catch {
    setSyncStatus("Could not save to Google Sheets.");
  }
}

function requestCloudSave() {
  if (syncApplying || !syncConfigured()) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    saveCloudAssistantState({ silent: true });
  }, 900);
}

function setEventNote(id, note) {
  const cleanNote = note.trim();
  if (cleanNote) eventNotes[id] = cleanNote;
  else delete eventNotes[id];
  saveEventNotes();
}

function eventById(id) {
  return events.find((event) => event.id === id);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function createFilterActions(group) {
  const actions = document.createElement("div");
  actions.className = "filter-actions";
  actions.innerHTML = `
    <button type="button" data-filter-action="all" data-group="${group}">All</button>
    <button type="button" data-filter-action="clear" data-group="${group}">Clear</button>
  `;
  return actions;
}

function fillCheckboxOptions(container, group, values, { checked = false } = {}) {
  container.replaceChildren(
    createFilterActions(group),
    ...values.map((value) => {
      const id = `${group}-${slug(value)}`;
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.innerHTML = `
        <input id="${id}" type="checkbox" value="${escapeHtml(value)}"${checked ? " checked" : ""}>
        <span>${escapeHtml(value)}</span>
      `;
      return label;
    }),
  );
}

function fillTypeOptions(container, values) {
  const facebookId = "type-facebook-only";
  const facebookLabel = document.createElement("label");
  facebookLabel.className = "filter-special";
  facebookLabel.setAttribute("for", facebookId);
  facebookLabel.innerHTML = `
    <input id="${facebookId}" name="type-special" type="radio" value="Facebook only">
    <span>Facebook only</span>
  `;

  const typeLabels = values.map((value) => {
    const id = `type-${slug(value)}`;
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.innerHTML = `
      <input id="${id}" type="checkbox" value="${escapeHtml(value)}" checked>
      <span>${escapeHtml(value)}</span>
    `;
    return label;
  });

  container.replaceChildren(createFilterActions("type"), facebookLabel, ...typeLabels);
}

function fillCityOptions(values) {
  fillCheckboxOptions(els.cityOptions, "city", values);
}

function selectedValues(container) {
  return [...container.querySelectorAll("input:checked")].map((input) => input.value);
}

function selectedCities() {
  return selectedValues(els.cityOptions);
}

function selectedSources() {
  return selectedValues(els.sourceOptions);
}

function isFacebookOnlyFilterActive() {
  return Boolean(els.typeOptions.querySelector('input[value="Facebook only"]:checked'));
}

function selectedTypeValues() {
  return [...els.typeOptions.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function updateMultiSummary(summaryEl, selected, allValues, label) {
  if (!selected.length) {
    summaryEl.textContent = `No ${label} selected`;
  } else if (selected.length === allValues.length) {
    summaryEl.textContent = `All ${label}`;
  } else if (selected.length === 1) {
    summaryEl.textContent = selected[0];
  } else {
    summaryEl.textContent = `${selected.length} ${label} selected`;
  }
}

function updateMonthSummary() {
  updateMultiSummary(els.monthSummary, selectedValues(els.monthOptions), activeMonthValues(), "months");
}

function updateTypeSummary() {
  if (isFacebookOnlyFilterActive()) {
    els.typeSummary.textContent = "Facebook only";
    return;
  }

  updateMultiSummary(els.typeSummary, selectedTypeValues(), typeValues, "types");
}

function updateCitySummary() {
  const cities = selectedCities();
  if (!cities.length) {
    els.citySummary.textContent = "All cities";
  } else if (cities.length === 1) {
    els.citySummary.textContent = cities[0];
  } else {
    els.citySummary.textContent = `${cities.length} cities selected`;
  }
}

function updateSourceSummary() {
  updateMultiSummary(els.sourceSummary, selectedSources(), sourceValues, "sources");
}

function eventText(event) {
  return [event.title, event.venue, event.city, event.address, event.description, event.type, event.source]
    .join(" ")
    .toLowerCase();
}

function isFacebookLinkedEvent(event) {
  return [event.sourceUrl, event.url, event.calendarUrl]
    .filter(Boolean)
    .some((url) => /(^|\/\/)(www\.)?facebook\.com\//i.test(url));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function eventDateKey(event, field = "startDate") {
  const timeZone = event.allDay ? "UTC" : "America/New_York";
  return dateKey(new Date(event[field] || event.startDate), timeZone);
}

function matchesDateRange(event) {
  const startKey = eventDateKey(event);
  const endKey = eventDateKey(event, "endDate");
  const selectedRange = els.dateRange.value;

  if (selectedRange === "allFuture") return endKey >= todayKey;
  if (selectedRange === "rest2026") return endKey >= todayKey && startKey <= "20261231";
  if (selectedRange === "year2027") return endKey >= "20270101" && startKey <= "20271231";
  if (selectedRange === "next30") return endKey >= todayKey && startKey <= dateKey(addDays(today, 30));
  if (selectedRange === "next90") return endKey >= todayKey && startKey <= dateKey(addDays(today, 90));
  return endKey >= todayKey;
}

function getFilteredEvents() {
  const query = els.search.value.trim().toLowerCase();
  const months = selectedValues(els.monthOptions);
  const selectedTypes = selectedTypeValues();
  const facebookOnly = isFacebookOnlyFilterActive();
  const selectedEventTypes = selectedTypes.filter((value) => value !== "Recurring");
  const includeRecurring = selectedTypes.includes("Recurring");
  const cities = selectedCities();
  const sources = selectedSources();

  const filtered = events.filter((event) => {
    const recurrence = detectRecurrence(event);
    const hasSelectedEventTypes = selectedEventTypes.length > 0;
    const matchesQuery = !query || eventText(event).includes(query);
    const matchesDate = matchesDateRange(event);
    const matchesMonth = months.includes(event.month);
    const matchesType = facebookOnly
      ? isFacebookLinkedEvent(event)
      : hasSelectedEventTypes
        ? selectedEventTypes.includes(event.type) && (includeRecurring || !recurrence)
        : includeRecurring && recurrence;
    const matchesCity = !cities.length || cities.includes(event.city);
    const matchesSource = sources.includes(event.source || "CCCHR");
    return matchesQuery && matchesDate && matchesMonth && matchesType && matchesCity && matchesSource;
  });

  return filtered.sort((a, b) => {
    if (els.sort.value === "date-desc") return b.startDate.localeCompare(a.startDate);
    if (els.sort.value === "city") return (a.city || "").localeCompare(b.city || "") || a.startDate.localeCompare(b.startDate);
    if (els.sort.value === "type") return a.type.localeCompare(b.type) || a.startDate.localeCompare(b.startDate);
    return a.startDate.localeCompare(b.startDate);
  });
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeCalendarText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatCalendarDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatCalendarDay(value) {
  return new Date(value).toISOString().slice(0, 10).replace(/-/g, "");
}

function nextCalendarDay(value) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return formatCalendarDay(date);
}

function eventYear(event) {
  return new Date(event.startDate).toLocaleDateString("en-US", {
    year: "numeric",
    timeZone: "America/New_York",
  });
}

function recurrenceUntil(event) {
  return `${eventYear(event)}1231T235959Z`;
}

function weekdayCode(event) {
  return new Date(event.startDate).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).slice(0, 2).toUpperCase();
}

function ordinalPrefix(value) {
  const map = {
    "1": "1",
    "1st": "1",
    first: "1",
    "2": "2",
    "2nd": "2",
    second: "2",
    "3": "3",
    "3rd": "3",
    third: "3",
    "4": "4",
    "4th": "4",
    fourth: "4",
    last: "-1",
  };
  return map[String(value).toLowerCase()] || "";
}

function dayCode(value) {
  const key = String(value).toLowerCase().replace(/['\u2019]/g, "").replace(/s$/, "");
  const map = {
    sun: "SU",
    sunday: "SU",
    mon: "MO",
    monday: "MO",
    tue: "TU",
    tues: "TU",
    tuesday: "TU",
    wed: "WE",
    wednesday: "WE",
    thu: "TH",
    thurs: "TH",
    thursday: "TH",
    fri: "FR",
    friday: "FR",
    sat: "SA",
    saturday: "SA",
  };
  return map[key] || "";
}

function detectRecurrence(event) {
  const text = `${event.title} ${event.description}`
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s\b/g, "$1");
  const until = recurrenceUntil(event);

  if (/twice weekly/.test(text)) {
    return {
      label: "Repeats Fridays and Saturdays",
      rule: `FREQ=WEEKLY;BYDAY=FR,SA;UNTIL=${until}`,
    };
  }

  if (/every other\s+(tue|tues|tuesday)/.test(text)) {
    return {
      label: "Repeats every other Tuesday",
      rule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;UNTIL=${until}`,
    };
  }

  const multiOrdinal = text.match(/\b(1st|2nd|3rd|4th|first|second|third|fourth)\s*(?:&|and)\s*(1st|2nd|3rd|4th|first|second|third|fourth)\s+(sun|mon|tue|tues|wed|thu|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (multiOrdinal) {
    const day = dayCode(multiOrdinal[3]);
    const days = [ordinalPrefix(multiOrdinal[1]), ordinalPrefix(multiOrdinal[2])].map((ordinal) => `${ordinal}${day}`);
    return {
      label: `Repeats ${multiOrdinal[1]} and ${multiOrdinal[2]} ${multiOrdinal[3]}`,
      rule: `FREQ=MONTHLY;BYDAY=${days.join(",")};UNTIL=${until}`,
    };
  }

  const singleOrdinal = text.match(/\b(last|1st|2nd|3rd|4th|first|second|third|fourth)\s+(sun|mon|tue|tues|wed|thu|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (singleOrdinal) {
    const day = dayCode(singleOrdinal[2]);
    const ordinal = ordinalPrefix(singleOrdinal[1]);
    return {
      label: `Repeats ${singleOrdinal[1]} ${singleOrdinal[2]}`,
      rule: `FREQ=MONTHLY;BYDAY=${ordinal}${day};UNTIL=${until}`,
    };
  }

  if (/\bweekly\b|every\s+(sun|mon|tue|tues|wed|thu|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/.test(text)) {
    return {
      label: "Repeats weekly",
      rule: `FREQ=WEEKLY;BYDAY=${weekdayCode(event)};UNTIL=${until}`,
    };
  }

  if (/\bmonthly\b|every month|each month/.test(text)) {
    return {
      label: "Repeats monthly",
      rule: `FREQ=MONTHLY;BYMONTHDAY=${new Date(event.startDate).getDate()};UNTIL=${until}`,
    };
  }

  return null;
}

function calendarFileName(event) {
  return `${event.dateLabel}-${event.title}`
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) + ".ics";
}

function buildCalendarFile(event) {
  const location = [event.venue, event.address].filter(Boolean).join(", ");
  const recurrence = detectRecurrence(event);
  const recurrenceNote = recurrence ? `Recurrence detected by dashboard: ${recurrence.label}` : "";
  const eventUrl = event.url || event.sourceUrl || "";
  const description = [recurrenceNote, event.description, eventUrl].filter(Boolean).join("\\n\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CCCHR Dashboard//2026 Car Shows//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@ccchr-dashboard.local`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
  ];
  if (eventUrl) lines.push(`URL:${eventUrl}`);
  if (event.allDay) {
    lines.splice(8, 0, `DTSTART;VALUE=DATE:${formatCalendarDay(event.startDate)}`);
    lines.splice(9, 0, `DTEND;VALUE=DATE:${nextCalendarDay(event.endDate)}`);
  } else {
    lines.splice(8, 0, `DTSTART:${formatCalendarDate(event.startDate)}`);
    lines.splice(9, 0, `DTEND:${formatCalendarDate(event.endDate)}`);
  }
  if (recurrence) {
    lines.push(`RRULE:${recurrence.rule}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function displayTimeZone(event) {
  return event.allDay ? "UTC" : "America/New_York";
}

function eventDateParts(event) {
  const timeZone = displayTimeZone(event);
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const startKey = dateKey(start, timeZone);
  const endKey = dateKey(end, timeZone);
  const startParts = {
    month: start.toLocaleDateString("en-US", { month: "short", timeZone }),
    longMonth: start.toLocaleDateString("en-US", { month: "long", timeZone }),
    day: start.toLocaleDateString("en-US", { day: "numeric", timeZone }),
    year: start.toLocaleDateString("en-US", { year: "numeric", timeZone }),
    weekday: start.toLocaleDateString("en-US", { weekday: "short", timeZone }),
  };
  const endParts = {
    month: end.toLocaleDateString("en-US", { month: "short", timeZone }),
    longMonth: end.toLocaleDateString("en-US", { month: "long", timeZone }),
    day: end.toLocaleDateString("en-US", { day: "numeric", timeZone }),
    year: end.toLocaleDateString("en-US", { year: "numeric", timeZone }),
    weekday: end.toLocaleDateString("en-US", { weekday: "short", timeZone }),
  };

  return { startKey, endKey, startParts, endParts, sameDay: startKey === endKey };
}

function eventDateLine(event) {
  const { startParts, endParts, sameDay } = eventDateParts(event);

  if (sameDay) {
    return event.allDay
      ? `${startParts.month} ${startParts.day}, ${startParts.year} | All day`
      : `${startParts.month} ${startParts.day}, ${startParts.year} at ${event.timeLabel}`;
  }

  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    return `${startParts.month} ${startParts.day}-${endParts.day}, ${endParts.year} | All day`;
  }

  return `${startParts.month} ${startParts.day}-${endParts.month} ${endParts.day}, ${endParts.year} | All day`;
}

function eventDateTile(event) {
  const { startParts, endParts, sameDay } = eventDateParts(event);

  if (sameDay) {
    return {
      top: startParts.month,
      middle: startParts.day,
      bottom: startParts.weekday,
    };
  }

  if (startParts.month === endParts.month) {
    return {
      top: startParts.month,
      middle: `${startParts.day}-${endParts.day}`,
      bottom: `${startParts.weekday}-${endParts.weekday}`,
    };
  }

  return {
    top: `${startParts.month}-${endParts.month}`,
    middle: `${startParts.day}-${endParts.day}`,
    bottom: `${startParts.weekday}-${endParts.weekday}`,
  };
}

function topEntry(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || ["-", 0];
}

function renderStats(items) {
  const cityCount = unique(items.map((event) => event.city)).length;
  const [topMonth] = topEntry(countBy(items, "month"));
  const dates = items.map((event) => new Date(event.startDate)).sort((a, b) => a - b);
  els.total.textContent = items.length.toLocaleString();
  els.cities.textContent = cityCount.toLocaleString();
  els.topMonth.textContent = topMonth;
  els.range.textContent = dates.length
    ? `${dates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${dates.at(-1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "-";
  const prefix = isFacebookOnlyFilterActive() ? "Facebook-only: " : "";
  els.resultCount.textContent = `${prefix}${items.length.toLocaleString()} matching event${items.length === 1 ? "" : "s"}`;
}

function renderFreshness() {
  els.currentDate.textContent = `Today: ${today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  })}`;

  els.refreshDate.textContent = metadata.refreshedAt
    ? `Last refreshed: ${new Date(metadata.refreshedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short",
    })}`
    : "Last refreshed: unknown";
}

function renderChart(items) {
  const counts = countBy(items, "month");
  const countsBySource = items.reduce((acc, event) => {
    const month = event.month || "Unknown";
    const source = event.source || "CCCHR";
    acc[month] = acc[month] || {};
    acc[month][source] = (acc[month][source] || 0) + 1;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(counts));
  const activeMonths = activeMonthValues();

  els.chart.replaceChildren(
    ...activeMonths.map((month) => {
      const count = counts[month] || 0;
      const ccchrCount = countsBySource[month]?.CCCHR || 0;
      const aacaCount = countsBySource[month]?.AACA || 0;
      const aacaLocalCount = countsBySource[month]?.["AACA Local"] || 0;
      const carlisleCount = countsBySource[month]?.Carlisle || 0;
      const traacaCount = countsBySource[month]?.TRAACA || 0;
      const manualCount = countsBySource[month]?.Manual || 0;
      const totalHeight = Math.max(8, (count / max) * 140);
      const ccchrHeight = count ? (ccchrCount / count) * totalHeight : 0;
      const aacaHeight = count ? (aacaCount / count) * totalHeight : 0;
      const aacaLocalHeight = count ? (aacaLocalCount / count) * totalHeight : 0;
      const carlisleHeight = count ? (carlisleCount / count) * totalHeight : 0;
      const traacaHeight = count ? (traacaCount / count) * totalHeight : 0;
      const manualHeight = count ? (manualCount / count) * totalHeight : 0;
      const wrapper = document.createElement("div");
      wrapper.className = "month-bar";
      wrapper.dataset.month = month;
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("aria-label", `Show ${month} events`);
      wrapper.innerHTML = `
        <div class="bar-count">${count}</div>
        <div class="bar" style="height:${totalHeight}px" aria-label="${month}: ${ccchrCount} CCCHR, ${aacaCount} AACA, ${aacaLocalCount} AACA Local, ${traacaCount} TRAACA, ${carlisleCount} Carlisle, ${manualCount} Manual">
          ${manualCount ? `<span class="bar-segment bar-manual" style="height:${manualHeight}px"></span>` : ""}
          ${carlisleCount ? `<span class="bar-segment bar-carlisle" style="height:${carlisleHeight}px"></span>` : ""}
          ${traacaCount ? `<span class="bar-segment bar-traaca" style="height:${traacaHeight}px"></span>` : ""}
          ${aacaLocalCount ? `<span class="bar-segment bar-aaca-local" style="height:${aacaLocalHeight}px"></span>` : ""}
          ${aacaCount ? `<span class="bar-segment bar-aaca" style="height:${aacaHeight}px"></span>` : ""}
          ${ccchrCount ? `<span class="bar-segment bar-ccchr" style="height:${ccchrHeight}px"></span>` : ""}
        </div>
        <div class="month-label">${month.slice(0, 3)}</div>
      `;
      return wrapper;
    }),
  );
}

function deadlineDateFromNote(note) {
  const text = String(note || "");
  const datePattern = /\b(?:Monday,\s*|Tuesday,\s*|Wednesday,\s*|Thursday,\s*|Friday,\s*|Saturday,\s*|Sunday,\s*)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/i;
  const match = text.match(datePattern);
  if (!match) return "";

  return match[0]
    .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deadlineForEvent(event) {
  if (event.registrationDeadlineNote) {
    return {
      event,
      note: event.registrationDeadlineNote,
      date: deadlineDateFromNote(event.registrationDeadlineNote),
    };
  }

  const text = [event.description, event.title].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const deadlinePattern = /\b(registration deadline|register by|pre[- ]?register(?: by)?|pre[- ]?registration|registration closes|deadline|last day to register|vendor deadline)\b/i;
  const parts = text.split(/(?<=[.!?])\s+|\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  const sentence = parts.find((part) => deadlinePattern.test(part));
  if (!sentence) return null;

  const note = sentence.length > 180 ? `${sentence.slice(0, 177)}...` : sentence;

  return {
    event,
    note,
    date: deadlineDateFromNote(note),
  };
}

function plannerItemHtml(event, { action = "" } = {}) {
  const note = noteForEvent(event.id);
  const deadline = deadlineForEvent(event);
  const eventUrl = event.url || event.sourceUrl || "";
  const title = escapeHtml(event.title);
  return `
    <div class="planner-item">
      ${eventUrl ? `<a href="${escapeHtml(eventUrl)}" target="_blank" rel="noreferrer">${title}</a>` : `<strong>${title}</strong>`}
      ${deadline?.date ? `<strong class="deadline-date">Deadline: ${escapeHtml(deadline.date)}</strong>` : ""}
      <span>${escapeHtml(event.dateLabel)} | ${escapeHtml(event.city || event.source || "")}</span>
      ${note ? `<p class="planner-note">${escapeHtml(note)}</p>` : ""}
      ${action}
    </div>
  `;
}

function renderInterestedPanel() {
  const items = interestedEvents();

  els.interestedCount.textContent = items.length.toLocaleString();
  els.interestedList.innerHTML = items.length
    ? items.map((event) => plannerItemHtml(event, {
      action: `<button type="button" data-remove-interest="${escapeHtml(event.id)}">Remove</button>`,
    })).join("")
    : `<p class="assistant-empty">Check Interested on events you want to remember.</p>`;
}

function interestedEvents() {
  return [...interestedIds]
    .map(eventById)
    .filter(Boolean)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function renderDeadlinePanel() {
  const deadlines = interestedEvents()
    .map(deadlineForEvent)
    .filter(Boolean);

  els.deadlineCount.textContent = deadlines.length.toLocaleString();
  els.deadlineList.innerHTML = deadlines.length
    ? deadlines.map(({ event, note, date }) => {
      const eventUrl = event.url || event.sourceUrl || "";
      const title = escapeHtml(event.title);
      return `
        <div class="planner-item deadline-item">
          ${eventUrl ? `<a href="${escapeHtml(eventUrl)}" target="_blank" rel="noreferrer">${title}</a>` : `<strong>${title}</strong>`}
          <strong class="deadline-date">${escapeHtml(date || note)}</strong>
          <span>${escapeHtml(event.dateLabel)} | ${escapeHtml(event.city || event.source || "")}</span>
        </div>
      `;
    }).join("")
    : `<p class="assistant-empty">No registration deadline language found in your Interested events.</p>`;
}

function renderAssistant(items) {
  renderInterestedPanel();
  renderDeadlinePanel();
  renderInsights(items);
}

function renderInsights(items) {
  const [city, cityCount] = topEntry(countBy(items, "city"));
  const [type, typeCount] = topEntry(countBy(items, "type"));
  const weekends = items.filter((event) => ["Sat", "Sun"].includes(event.weekday)).length;
  const next = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const blocks = [
    ["Top city", `${city} (${cityCount})`],
    ["Top type", `${type} (${typeCount})`],
    ["Weekend events", `${weekends} of ${items.length}`],
    ["Deadlines found", `${events.filter((event) => event.registrationDeadlineNote).length} total`],
    ["First match", next ? `${next.dateLabel}: ${next.title}` : "No matching events"],
  ];

  els.insights.replaceChildren(
    ...blocks.map(([title, body]) => {
      const item = document.createElement("div");
      item.className = "insight";
      item.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
      return item;
    }),
  );
}

function renderEvents(items) {
  if (!items.length) {
    els.list.innerHTML = `<div class="empty">No events match the current filters.</div>`;
    return;
  }

  els.list.replaceChildren(
    ...items.map((event) => {
      const card = document.createElement("article");
      const facebookLinked = isFacebookLinkedEvent(event);
      const facebookStandalone = facebookLinked && isFacebookOnlyFilterActive();
      card.className = `event-card${facebookStandalone ? " event-card-facebook" : ""}`;
      const recurrence = detectRecurrence(event);
      const calendarHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildCalendarFile(event))}`;
      const title = escapeHtml(event.title);
      const city = escapeHtml(event.city || "Location TBD");
      const venue = escapeHtml(event.venue);
      const address = escapeHtml(event.address);
      const description = escapeHtml(event.description);
      const source = escapeHtml(event.source || "CCCHR");
      const sourceClass = slug(source);
      const titleClass = `event-title event-title-${sourceClass}${facebookStandalone ? " event-title-facebook" : ""}`;
      const listingLabel = event.source === "AACA" ? "AACA listing" : event.source === "AACA Local" ? "AACA local listing" : event.source === "TRAACA" ? "TRAACA listing" : event.source === "Carlisle" ? "Carlisle listing" : event.source === "Manual" ? "Manual entry" : "CCCHR listing";
      const eventUrl = event.url || event.sourceUrl || "";
      const titleHtml = eventUrl ? `<a href="${escapeHtml(eventUrl)}" target="_blank" rel="noreferrer">${title}</a>` : title;
      const dateLine = escapeHtml(eventDateLine(event));
      const tile = eventDateTile(event);
      const note = escapeHtml(noteForEvent(event.id));
      card.innerHTML = `
        <div class="date-tile">
          <div>
            <span>${escapeHtml(tile.top)}</span>
            <span class="day">${escapeHtml(tile.middle)}</span>
            <span>${escapeHtml(tile.bottom)}</span>
          </div>
        </div>
        <div class="event-main">
          <div class="event-topline">
            <span class="pill type">${escapeHtml(event.type)}</span>
            <button type="button" class="pill source source-${sourceClass}" data-source="${source}">${source}</button>
            <label class="interested-toggle">
              <input type="checkbox" data-interest-id="${escapeHtml(event.id)}"${interestedIds.has(event.id) ? " checked" : ""}>
              <span>Interested</span>
            </label>
            ${facebookLinked ? `<span class="pill source-facebook">Facebook info</span>` : ""}
            <span class="pill">${city}</span>
            ${recurrence ? `<span class="pill">${escapeHtml(recurrence.label)}</span>` : ""}
          </div>
          <h3 class="${titleClass}">${titleHtml}</h3>
          <div class="event-meta">${dateLine}${venue ? ` | ${venue}` : ""}</div>
          ${address ? `<div class="event-address">${address}</div>` : ""}
          ${description ? `<p class="event-description">${description}</p>` : ""}
          <div class="event-actions">
            <a href="${calendarHref}" download="${escapeHtml(calendarFileName(event))}">${recurrence ? "Add Recurring Event" : "Add to Calendar"}</a>
            ${eventUrl ? `<a href="${escapeHtml(eventUrl)}" target="_blank" rel="noreferrer">${listingLabel}</a>` : ""}
            ${event.sourceUrl && event.sourceUrl !== event.url && event.sourceUrl !== event.calendarUrl ? `<a href="${event.sourceUrl}" target="_blank" rel="noreferrer">More info</a>` : ""}
            ${event.source === "Manual" ? `<button type="button" data-delete-manual="${escapeHtml(event.id)}">Remove Manual Show</button>` : ""}
          </div>
          <label class="event-note">
            <span>Note</span>
            <input type="text" data-note-id="${escapeHtml(event.id)}" value="${note}" placeholder="Paid online, paid check, call club...">
          </label>
        </div>
      `;
      return card;
    }),
  );
}

function render() {
  const filtered = getFilteredEvents();
  renderStats(filtered);
  renderChart(filtered);
  renderAssistant(filtered);
  renderEvents(filtered);
}

renderFreshness();

const manualTypeDefaults = ["Car show", "Cruise-in", "Meetup", "Swap meet", "Tour", "Other"];
let monthValues = [];
let typeValues = [];
let cityValues = [];
let sourceValues = [];

function rebuildFilterValues() {
  monthValues = monthOrder.filter((month) => events.some((event) => event.month === month));
  typeValues = [...unique([...events.map((event) => event.type), ...manualTypeDefaults]), "Recurring"];
  cityValues = unique(events.map((event) => event.city));
  sourceValues = unique([...events.map((event) => event.source || "CCCHR"), "Manual"]);
}

function refreshFilterControls() {
  fillTypeOptions(els.typeOptions, typeValues);
  fillCityOptions(cityValues);
  fillCheckboxOptions(els.sourceOptions, "source", sourceValues, { checked: true });
  refreshMonthOptions();
  updateTypeSummary();
  updateCitySummary();
  updateSourceSummary();
}

rebuildFilterValues();

function activeMonthValues() {
  return monthOrder.filter((month) => events.some((event) => event.month === month && matchesDateRange(event)));
}

function refreshMonthOptions() {
  const activeValues = activeMonthValues();
  const previous = new Set(selectedValues(els.monthOptions));
  const selected = activeValues.filter((month) => !previous.size || previous.has(month));

  fillCheckboxOptions(els.monthOptions, "month", activeValues, { checked: false });
  setCheckedValues(els.monthOptions, selected.length ? selected : activeValues);
  updateMonthSummary();
}

fillCheckboxOptions(els.monthOptions, "month", activeMonthValues(), { checked: true });
fillTypeOptions(els.typeOptions, typeValues);
fillCityOptions(cityValues);
fillCheckboxOptions(els.sourceOptions, "source", sourceValues, { checked: true });
updateMonthSummary();
updateTypeSummary();
updateCitySummary();
updateSourceSummary();

[els.search, els.sort].forEach((control) => {
  control.addEventListener("input", render);
});

els.dateRange.addEventListener("input", () => {
  refreshMonthOptions();
  render();
});

els.monthOptions.addEventListener("change", () => {
  updateMonthSummary();
  render();
});

els.typeOptions.addEventListener("change", (event) => {
  const facebookRadio = els.typeOptions.querySelector('input[value="Facebook only"]');

  if (event.target === facebookRadio && facebookRadio.checked) {
    els.typeOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  } else if (event.target.type === "checkbox") {
    facebookRadio.checked = false;
  }

  updateTypeSummary();
  render();
});

els.cityOptions.addEventListener("change", () => {
  updateCitySummary();
  updateSourceSummary();
  render();
});

els.sourceOptions.addEventListener("change", () => {
  updateSourceSummary();
  render();
});

populateSyncControls();

els.saveSyncSettings?.addEventListener("click", saveSyncSettings);
els.loadSyncData?.addEventListener("click", loadCloudAssistantState);
els.saveSyncData?.addEventListener("click", () => {
  saveSyncSettings();
  saveCloudAssistantState();
});

els.reset.addEventListener("click", () => {
  els.search.value = "";
  els.monthOptions.querySelectorAll("input").forEach((input) => {
    input.checked = true;
  });
  els.typeOptions.querySelectorAll("input").forEach((input) => {
    input.checked = input.type === "checkbox";
  });
  els.cityOptions.querySelectorAll("input:checked").forEach((input) => {
    input.checked = false;
  });
  els.sourceOptions.querySelectorAll("input").forEach((input) => {
    input.checked = true;
  });
  els.dateRange.value = "upcoming";
  refreshMonthOptions();
  els.assistantInput.value = "";
  els.assistantResponse.textContent = "Ask for a city, month, or type of event.";
  els.monthFilter.open = false;
  els.typeFilter.open = false;
  els.cityFilter.open = false;
  els.sourceFilter.open = false;
  updateMonthSummary();
  updateTypeSummary();
  updateCitySummary();
  updateSourceSummary();
  els.sort.value = "date-asc";
  render();
});

function setCheckedValues(container, values, { emptyMeansAll = false } = {}) {
  const wanted = new Set(values);
  container.querySelectorAll("input").forEach((input) => {
    input.checked = emptyMeansAll && !wanted.size ? true : wanted.has(input.value);
  });
}

function applyFilterAction(container, action, { checkboxSelector = 'input[type="checkbox"]', allChecked = true, clearChecked = false } = {}) {
  container.querySelectorAll(checkboxSelector).forEach((input) => {
    input.checked = action === "all" ? allChecked : clearChecked;
  });
}

function handleFilterAction(event) {
  const button = event.target.closest("[data-filter-action]");
  if (!button) return;

  const action = button.dataset.filterAction;
  const group = button.dataset.group;

  if (group === "month") {
    applyFilterAction(els.monthOptions, action);
    updateMonthSummary();
  } else if (group === "type") {
    applyFilterAction(els.typeOptions, action);
    const facebookRadio = els.typeOptions.querySelector('input[value="Facebook only"]');
    if (facebookRadio) facebookRadio.checked = false;
    updateTypeSummary();
  } else if (group === "city") {
    applyFilterAction(els.cityOptions, action, { allChecked: false, clearChecked: false });
    updateCitySummary();
  } else if (group === "source") {
    applyFilterAction(els.sourceOptions, action);
    updateSourceSummary();
  }

  render();
}

[els.monthOptions, els.typeOptions, els.cityOptions, els.sourceOptions].forEach((container) => {
  container.addEventListener("click", handleFilterAction);
});

function selectMonth(month) {
  setCheckedValues(els.monthOptions, [month]);
  updateMonthSummary();
  els.monthFilter.open = false;
  render();
  els.list.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectSource(source) {
  if (!sourceValues.includes(source)) return;
  els.search.value = "";
  setCheckedValues(els.monthOptions, activeMonthValues());
  setCheckedValues(els.typeOptions, typeValues);
  const facebookRadio = els.typeOptions.querySelector('input[value="Facebook only"]');
  if (facebookRadio) facebookRadio.checked = false;
  setCheckedValues(els.cityOptions, []);
  setCheckedValues(els.sourceOptions, [source]);
  updateMonthSummary();
  updateTypeSummary();
  updateCitySummary();
  updateSourceSummary();
  render();
  els.list.scrollIntoView({ behavior: "smooth", block: "start" });
}

els.chart.addEventListener("click", (event) => {
  const bar = event.target.closest(".month-bar");
  if (bar?.dataset.month) selectMonth(bar.dataset.month);
});

els.chart.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const bar = event.target.closest(".month-bar");
  if (!bar?.dataset.month) return;
  event.preventDefault();
  selectMonth(bar.dataset.month);
});

document.querySelector(".legend")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source]");
  if (button?.dataset.source) selectSource(button.dataset.source);
});


els.manualForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const manualEvent = createManualEvent();
  if (!manualEvent) return;
  saveManualEvent(manualEvent);
  await saveCloudAssistantState({ silent: true });
  window.location.search = "?fresh=26";
});

function exportPdfReport() {
  const rows = events.map((event) => {
    const deadline = deadlineForEvent(event)?.date || "";
    return `<tr>
      <td>${escapeHtml(event.dateLabel)}</td>
      <td>${escapeHtml(event.title)}</td>
      <td>${escapeHtml(event.city || "")}</td>
      <td>${escapeHtml(event.type || "")}</td>
      <td>${escapeHtml(event.source || "")}</td>
      <td>${escapeHtml(deadline)}</td>
      <td>${escapeHtml(event.venue || "")}</td>
      <td>${escapeHtml(event.description || "")}</td>
    </tr>`;
  }).join("");
  const report = window.open("", "_blank");
  if (!report) return;
  report.document.write(`<!doctype html><html><head><title>Car Show Calendar Export</title>
    <style>body{font-family:Arial,sans-serif;color:#111820}h1{font-size:22px}p{color:#555}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:5px;vertical-align:top}th{background:#f0f0f0;text-align:left}@media print{button{display:none}}</style>
    </head><body><button onclick="window.print()">Print or Save as PDF</button><h1>Car Show Calendar Export</h1><p>${events.length} events. Generated ${new Date().toLocaleString("en-US")}.</p><table><thead><tr><th>Date</th><th>Event</th><th>City</th><th>Type</th><th>Source</th><th>Deadline</th><th>Venue</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  report.document.close();
  report.focus();
}

els.exportPdf?.addEventListener("click", exportPdfReport);

els.list.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("button[data-delete-manual]");
  if (deleteButton) {
    deleteManualEvent(deleteButton.dataset.deleteManual);
    return;
  }

  const button = event.target.closest("button[data-source]");
  if (button?.dataset.source) selectSource(button.dataset.source);
});

els.list.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-interest-id]");
  if (!input) return;

  if (input.checked) interestedIds.add(input.dataset.interestId);
  else interestedIds.delete(input.dataset.interestId);
  saveInterestedIds();
  renderAssistant(getFilteredEvents());
});

els.list.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-note-id]");
  if (!input) return;

  setEventNote(input.dataset.noteId, input.value);
  renderInterestedPanel();
});

els.interestedList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-interest]");
  if (!button) return;

  interestedIds.delete(button.dataset.removeInterest);
  saveInterestedIds();
  render();
});

function assistantTypeMatches(query) {
  const aliases = [
    ["Car show", /\b(show|car show|shine)\b/],
    ["Cruise-in", /\b(cruise|cruise-in|cruz)\b/],
    ["Tour", /\b(tour|drive|trip)\b/],
    ["Meetup", /\b(meet|meeting|dinner|brunch|cookoff|auction)\b/],
    ["Cars & coffee", /\b(coffee)\b/],
    ["National show", /\b(national|nationals)\b/],
    ["Swap meet", /\b(swap)\b/],
  ];
  return unique([
    ...typeValues.filter((type) => query.includes(type.toLowerCase())),
    ...aliases.filter(([, pattern]) => pattern.test(query)).map(([type]) => type),
  ]).filter((type) => typeValues.includes(type));
}

function runAssistant() {
  const query = els.assistantInput.value.trim().toLowerCase();
  if (!query) {
    els.assistantResponse.textContent = "Try a city, month, or event type.";
    return;
  }

  const matchedMonths = monthValues.filter((month) => {
    const lower = month.toLowerCase();
    return query.includes(lower) || query.includes(lower.slice(0, 3));
  });
  const matchedCities = cityValues.filter((city) => query.includes(city.toLowerCase()));
  const matchedTypes = assistantTypeMatches(query);

  if (/\b2027\b|next year/.test(query)) els.dateRange.value = "year2027";
  else if (/\brest of 2026|2026\b/.test(query)) els.dateRange.value = "rest2026";
  else if (/\ball|future|everything\b/.test(query)) els.dateRange.value = "allFuture";
  else if (/\b90\b|three months/.test(query)) els.dateRange.value = "next90";
  else if (/\b30\b|this month|next month/.test(query)) els.dateRange.value = "next30";
  else els.dateRange.value = "upcoming";

  refreshMonthOptions();
  if (matchedMonths.length) setCheckedValues(els.monthOptions, matchedMonths.filter((month) => activeMonthValues().includes(month)));
  if (matchedCities.length) setCheckedValues(els.cityOptions, matchedCities);
  const matchedSources = sourceValues.filter((source) => query.includes(source.toLowerCase()));
  if (matchedSources.length) setCheckedValues(els.sourceOptions, matchedSources);
  if (matchedTypes.length) {
    setCheckedValues(els.typeOptions, matchedTypes);
    const facebookRadio = els.typeOptions.querySelector('input[value="Facebook only"]');
    if (facebookRadio) facebookRadio.checked = false;
  }

  const handled = matchedMonths.length || matchedCities.length || matchedTypes.length || matchedSources.length;
  els.search.value = handled ? "" : query;
  updateMonthSummary();
  updateTypeSummary();
  updateCitySummary();
  updateSourceSummary();
  render();

  const pieces = [
    matchedCities.length ? matchedCities.join(", ") : "any city",
    matchedMonths.length ? matchedMonths.join(", ") : "selected date range",
    matchedTypes.length ? matchedTypes.join(", ") : "any type",
    matchedSources.length ? matchedSources.join(", ") : "any source",
  ];
  els.assistantResponse.textContent = `Showing ${pieces.join(" | ")}.`;
}

els.assistantButton.addEventListener("click", runAssistant);
els.assistantInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runAssistant();
});

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=26").catch(() => {});
  });
}
