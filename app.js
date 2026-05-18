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
  month: document.querySelector("#monthSelect"),
  type: document.querySelector("#typeSelect"),
  cityFilter: document.querySelector("#cityFilter"),
  cityOptions: document.querySelector("#cityOptions"),
  citySummary: document.querySelector("#citySummary"),
  sort: document.querySelector("#sortSelect"),
  reset: document.querySelector("#resetButton"),
  total: document.querySelector("#totalEvents"),
  cities: document.querySelector("#activeCities"),
  topMonth: document.querySelector("#topMonth"),
  range: document.querySelector("#dateRange"),
  resultCount: document.querySelector("#resultCount"),
  chart: document.querySelector("#monthChart"),
  list: document.querySelector("#eventList"),
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
const events = allEvents.filter((event) => {
  const timeZone = event.allDay ? "UTC" : "America/New_York";
  return dateKey(new Date(event.startDate), timeZone) >= todayKey;
});

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, label, values) {
  select.replaceChildren(new Option(label, "all"), ...values.map((value) => new Option(value, value)));
}

function fillCityOptions(values) {
  els.cityOptions.replaceChildren(
    ...values.map((city) => {
      const id = `city-${city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.innerHTML = `
        <input id="${id}" type="checkbox" value="${escapeHtml(city)}">
        <span>${escapeHtml(city)}</span>
      `;
      return label;
    }),
  );
}

function selectedCities() {
  return [...els.cityOptions.querySelectorAll("input:checked")].map((input) => input.value);
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

function eventText(event) {
  return [event.title, event.venue, event.city, event.address, event.description, event.type]
    .join(" ")
    .toLowerCase();
}

function getFilteredEvents() {
  const query = els.search.value.trim().toLowerCase();
  const month = els.month.value;
  const type = els.type.value;
  const cities = selectedCities();

  const filtered = events.filter((event) => {
    const matchesQuery = !query || eventText(event).includes(query);
    const matchesMonth = month === "all" || event.month === month;
    const matchesType = type === "all" || event.type === type;
    const matchesCity = !cities.length || cities.includes(event.city);
    return matchesQuery && matchesMonth && matchesType && matchesCity;
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
  const description = [recurrenceNote, event.description, event.url].filter(Boolean).join("\\n\\n");
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
    `URL:${event.url}`,
  ];
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
  els.resultCount.textContent = `${items.length.toLocaleString()} matching event${items.length === 1 ? "" : "s"}`;
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
  const activeMonths = monthOrder.filter((month) => events.some((event) => event.month === month));

  els.chart.replaceChildren(
    ...activeMonths.map((month) => {
      const count = counts[month] || 0;
      const ccchrCount = countsBySource[month]?.CCCHR || 0;
      const aacaCount = countsBySource[month]?.AACA || 0;
      const carlisleCount = countsBySource[month]?.Carlisle || 0;
      const totalHeight = Math.max(8, (count / max) * 140);
      const ccchrHeight = count ? (ccchrCount / count) * totalHeight : 0;
      const aacaHeight = count ? (aacaCount / count) * totalHeight : 0;
      const carlisleHeight = count ? (carlisleCount / count) * totalHeight : 0;
      const wrapper = document.createElement("div");
      wrapper.className = "month-bar";
      wrapper.innerHTML = `
        <div class="bar-count">${count}</div>
        <div class="bar" style="height:${totalHeight}px" aria-label="${month}: ${ccchrCount} CCCHR, ${aacaCount} AACA, ${carlisleCount} Carlisle">
          ${carlisleCount ? `<span class="bar-segment bar-carlisle" style="height:${carlisleHeight}px"></span>` : ""}
          ${aacaCount ? `<span class="bar-segment bar-aaca" style="height:${aacaHeight}px"></span>` : ""}
          ${ccchrCount ? `<span class="bar-segment bar-ccchr" style="height:${ccchrHeight}px"></span>` : ""}
        </div>
        <div class="month-label">${month.slice(0, 3)}</div>
      `;
      return wrapper;
    }),
  );
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
      card.className = "event-card";
      const recurrence = detectRecurrence(event);
      const calendarHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildCalendarFile(event))}`;
      const title = escapeHtml(event.title);
      const city = escapeHtml(event.city || "Location TBD");
      const venue = escapeHtml(event.venue);
      const address = escapeHtml(event.address);
      const description = escapeHtml(event.description);
      const source = escapeHtml(event.source || "CCCHR");
      const sourceClass = source.toLowerCase();
      const titleClass = `event-title event-title-${sourceClass}`;
      const listingLabel = event.source === "AACA" ? "AACA listing" : event.source === "Carlisle" ? "Carlisle listing" : "CCCHR listing";
      const dateLine = escapeHtml(eventDateLine(event));
      const tile = eventDateTile(event);
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
            <span class="pill source source-${sourceClass}">${source}</span>
            <span class="pill">${city}</span>
            ${recurrence ? `<span class="pill">${escapeHtml(recurrence.label)}</span>` : ""}
          </div>
          <h3 class="${titleClass}">${title}</h3>
          <div class="event-meta">${dateLine}${venue ? ` | ${venue}` : ""}</div>
          ${address ? `<div class="event-address">${address}</div>` : ""}
          ${description ? `<p class="event-description">${description}</p>` : ""}
          <div class="event-actions">
            <a href="${calendarHref}" download="${escapeHtml(calendarFileName(event))}">${recurrence ? "Add Recurring Event" : "Add to Calendar"}</a>
            <a href="${event.url}" target="_blank" rel="noreferrer">${listingLabel}</a>
            ${event.sourceUrl && event.sourceUrl !== event.url && event.sourceUrl !== event.calendarUrl ? `<a href="${event.sourceUrl}" target="_blank" rel="noreferrer">More info</a>` : ""}
          </div>
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
  renderInsights(filtered);
  renderEvents(filtered);
}

renderFreshness();

fillSelect(
  els.month,
  "All months",
  monthOrder.filter((month) => events.some((event) => event.month === month)),
);
fillSelect(els.type, "All types", unique(events.map((event) => event.type)));
fillCityOptions(unique(events.map((event) => event.city)));
updateCitySummary();

[els.search, els.month, els.type, els.sort].forEach((control) => {
  control.addEventListener("input", render);
});

els.cityOptions.addEventListener("change", () => {
  updateCitySummary();
  render();
});

els.reset.addEventListener("click", () => {
  els.search.value = "";
  els.month.value = "all";
  els.type.value = "all";
  els.cityOptions.querySelectorAll("input:checked").forEach((input) => {
    input.checked = false;
  });
  els.cityFilter.open = false;
  updateCitySummary();
  els.sort.value = "date-asc";
  render();
});

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=2").catch(() => {});
  });
}
