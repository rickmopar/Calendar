const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const rawDir = path.join(root, "raw");
const sourceUrl = "https://www.ccchr.org/events?format=json";
const aacaSourceUrl = "https://aaca.org/aacanationalshowsandtourscalendar/";
const carlisleSourceUrl = "https://carlisleevents.com/events";
const facebookSourceUrl = "https://www.facebook.com/ccchr/events";
const year = 2026;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&#x2013;/g, "-")
    .replace(/&#038;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<br\s*\/?>(?=\s*)/gi, " | ")
    .replace(/<[^>]*>/g, " ")
    .replace(/#block-[^}]+}\s*/g, "")
    .replace(/Listing is provided by our Partnership with Don Pablo presents Car Crazy in Tidewater!/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(event) {
  const text = `${event.title} ${decodeHtml(event.body)}`.toLowerCase();
  const types = [
    ["show", "Car show"],
    ["cruise", "Cruise-in"],
    ["cruz", "Cruise-in"],
    ["meet", "Meetup"],
    ["coffee", "Cars & coffee"],
    ["race", "Racing"],
    ["swap", "Swap meet"],
    ["jeep", "Jeep"],
    ["euro", "Euro"],
    ["mustang", "Mustang/Ford"],
  ];
  return (types.find(([keyword]) => text.includes(keyword)) || ["", "Other"])[1];
}

function withFormatJson(nextPageUrl) {
  const url = new URL(nextPageUrl, "https://www.ccchr.org");
  url.searchParams.set("format", "json");
  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/html;q=0.9,*/*;q=0.8",
      "user-agent": "CCCHR dashboard local refresh",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": "CCCHR dashboard local refresh",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed ${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

function normalize(event) {
  const date = new Date(event.startDate);
  const location = event.location || {};
  const city = (decodeHtml(location.addressLine2).split(",")[0] || "").trim();

  return {
    id: event.id,
    title: decodeHtml(event.title),
    startDate: new Date(event.startDate).toISOString(),
    endDate: new Date(event.endDate).toISOString(),
    month: date.toLocaleString("en-US", { month: "long", timeZone: "America/New_York" }),
    weekday: date.toLocaleString("en-US", { weekday: "short", timeZone: "America/New_York" }),
    dateLabel: date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    }),
    timeLabel: date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }),
    type: classify(event),
    source: "CCCHR",
    city,
    venue: decodeHtml(location.addressTitle),
    address: [decodeHtml(location.addressLine1), decodeHtml(location.addressLine2)].filter(Boolean).join(", "),
    description: decodeHtml(event.body),
    sourceUrl: event.sourceUrl || "",
    url: `https://www.ccchr.org${event.fullUrl}`,
    image: event.assetUrl || "",
  };
}

function monthNumber(monthName) {
  return {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  }[monthName.toLowerCase()];
}

function normalizeAacaType(title) {
  if (/tour/i.test(title)) return "Tour";
  if (/convention|awards/i.test(title)) return "Convention";
  if (/national/i.test(title)) return "National show";
  return "AACA event";
}

function normalizeCarlisleType(title) {
  if (/auction/i.test(title)) return "Auction";
  if (/flea market|corral/i.test(title)) return "Flea market";
  if (/nationals/i.test(title)) return "National show";
  return "Carlisle event";
}

function absoluteUrl(url, base) {
  if (!url) return "";
  return new URL(decodeHtml(url), base).toString();
}

function parseEventDateRange(value) {
  const cleaned = decodeHtml(value);
  const match = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?,\s*(\d{4})$/);
  if (!match) return null;

  const [, startMonthName, startDay, endMonthNameRaw, endDayRaw, eventYearRaw] = match;
  const eventYear = Number(eventYearRaw);
  if (eventYear !== year) return null;

  const startMonth = monthNumber(startMonthName);
  const endMonth = monthNumber(endMonthNameRaw || startMonthName);
  if (startMonth === undefined || endMonth === undefined) return null;

  return {
    startDate: new Date(Date.UTC(eventYear, startMonth, Number(startDay))),
    endDate: new Date(Date.UTC(eventYear, endMonth, Number(endDayRaw || startDay))),
  };
}

function normalizeAacaEvent(line, link, index) {
  const dateMatch = line.match(/^([A-Za-z]+)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})\s+-\s*(.+)$/);
  if (!dateMatch) return null;

  const [, monthName, startDay, endDayRaw, eventYearRaw, rest] = dateMatch;
  const eventYear = Number(eventYearRaw);
  if (eventYear !== year) return null;

  const month = monthNumber(monthName);
  if (month === undefined) return null;

  const startDate = new Date(Date.UTC(eventYear, month, Number(startDay)));
  const endDate = new Date(Date.UTC(eventYear, month, Number(endDayRaw || startDay)));
  const parts = rest.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  const title = parts[0] || "AACA National Event";
  const locationText = parts[1] || "";
  const locationParts = locationText.split(",").map((part) => part.trim()).filter(Boolean);
  const city = locationParts.length > 2
    ? locationParts[locationParts.length - 2]
    : locationParts[0] || "AACA";
  const host = parts.slice(2).join(" - ");
  const description = [line, host].filter(Boolean).join(" | ");

  return {
    id: `aaca-${eventYear}-${month + 1}-${startDay}-${index}`,
    title,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    allDay: true,
    month: startDate.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
    weekday: startDate.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" }),
    dateLabel: startDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    timeLabel: "All day",
    type: normalizeAacaType(title),
    source: "AACA",
    city,
    venue: "AACA National Shows and Tours",
    address: locationText,
    description,
    sourceUrl: link,
    url: link || aacaSourceUrl,
    image: "",
  };
}

async function fetchAacaEvents() {
  const html = await fetchText(aacaSourceUrl);
  fs.writeFileSync(path.join(rawDir, "aaca-national-calendar.html"), html);

  const events = [];
  const paragraphPattern = /<p><strong>([\s\S]*?)<\/strong><\/p>/gi;
  let match;
  let index = 0;

  while ((match = paragraphPattern.exec(html))) {
    const block = match[1];
    const text = decodeHtml(block);
    if (!new RegExp(`\\b${year}\\b`).test(text)) continue;
    const linkMatch = block.match(/href="([^"]+)"/i);
    const event = normalizeAacaEvent(text, linkMatch ? decodeHtml(linkMatch[1]) : aacaSourceUrl, index);
    if (event) {
      events.push(event);
      index += 1;
    }
  }

  return events;
}

function normalizeCarlisleEvent(block, index) {
  const titleMatch = block.match(/<img[^>]+alt="([^"]+)"/i);
  const dateMatch = block.match(/<h3 class="eventDate[^"]*">([\s\S]*?)<\/h3>/i);
  if (!titleMatch || !dateMatch) return null;

  const dates = parseEventDateRange(dateMatch[1]);
  if (!dates) return null;

  const detailMatch = block.match(/<a class="details cta-button" href="([^"]+)"/i)
    || block.match(/<a href="([^"]+)">\s*<h2>/i);
  const calendarMatch = block.match(/href="([^"]+\.ics[^"]*)"/i);
  const mapMatch = block.match(/<a href="([^"]+)">([^<]*(?:Fairgrounds|Expo Center)[^<]*)<\/a>/i);
  const locationMatch = block.match(/<div class="[^"]*location[^"]*">([\s\S]*?)<\/div>/i);
  const locationText = locationMatch ? decodeHtml(locationMatch[1]).replace(/^Location\s*/i, "") : "";
  const title = decodeHtml(titleMatch[1]);
  const venue = mapMatch ? decodeHtml(mapMatch[2]) : "Carlisle Events";
  const detailUrl = absoluteUrl(detailMatch ? detailMatch[1] : "/events/schedule", carlisleSourceUrl);
  const calendarUrl = absoluteUrl(calendarMatch ? calendarMatch[1] : "", carlisleSourceUrl);

  return {
    id: `carlisle-${dates.startDate.toISOString().slice(0, 10)}-${index}`,
    title,
    startDate: dates.startDate.toISOString(),
    endDate: dates.endDate.toISOString(),
    allDay: true,
    month: dates.startDate.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
    weekday: dates.startDate.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" }),
    dateLabel: dates.startDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    timeLabel: "All day",
    type: normalizeCarlisleType(title),
    source: "Carlisle",
    city: "Carlisle",
    venue,
    address: locationText || "Carlisle, PA",
    description: decodeHtml(block).replace(/\s+/g, " ").slice(0, 900),
    sourceUrl: calendarUrl,
    url: detailUrl,
    calendarUrl,
    image: "",
  };
}

async function fetchCarlisleEvents() {
  const html = await fetchText(carlisleSourceUrl);
  fs.writeFileSync(path.join(rawDir, "carlisle-events.html"), html);

  const blocks = html.split(/<div class="event">/i).slice(1);
  return blocks
    .map((block, index) => normalizeCarlisleEvent(block, index))
    .filter(Boolean);
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const seen = new Set();
  const all = [];
  let url = sourceUrl;
  let page = 1;

  while (url && page <= 40) {
    const json = await fetchJson(url);
    fs.writeFileSync(path.join(rawDir, `ccchr-events-page-${page}.json`), JSON.stringify(json, null, 2));

    for (const section of ["upcoming", "past"]) {
      for (const event of json[section] || []) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          all.push(event);
        }
      }
    }

    const oldest = Math.min(...all.map((event) => event.startDate));
    if (oldest < Date.parse(`${year}-01-01T00:00:00-05:00`)) break;

    url = json.pagination?.nextPageUrl ? withFormatJson(json.pagination.nextPageUrl) : "";
    page += 1;
  }

  const ccchrEvents = all
    .filter((event) => new Date(event.startDate).getFullYear() === year)
    .map(normalize);
  const aacaEvents = await fetchAacaEvents();
  const carlisleEvents = await fetchCarlisleEvents();
  const events = [...ccchrEvents, ...aacaEvents, ...carlisleEvents]
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const metadata = {
    sources: [
      "https://www.ccchr.org/events",
      aacaSourceUrl,
      carlisleSourceUrl,
      facebookSourceUrl,
    ],
    sourceCalendar: "https://www.ccchr.org/calendar",
    aacaSourceCalendar: aacaSourceUrl,
    carlisleSourceCalendar: carlisleSourceUrl,
    facebookSourceCalendar: facebookSourceUrl,
    sourceNotes: {
      Facebook: "Linked as a source page; Facebook does not expose public event records to the refresh script without an authenticated API or browser session.",
    },
    year,
    refreshedAt: new Date().toISOString(),
    totalEvents: events.length,
    sourceCounts: {
      CCCHR: ccchrEvents.length,
      AACA: aacaEvents.length,
      Carlisle: carlisleEvents.length,
    },
  };

  fs.writeFileSync(path.join(dataDir, "events-2026.json"), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(dataDir, "metadata.json"), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(
    path.join(dataDir, "events-2026.js"),
    `window.CCCHR_EVENTS_2026 = ${JSON.stringify(events, null, 2)};\nwindow.CCCHR_METADATA = ${JSON.stringify(metadata, null, 2)};\n`,
  );

  console.log(`Refreshed ${events.length} events for ${year}.`);
  console.log(`CCCHR: ${ccchrEvents.length}; AACA: ${aacaEvents.length}; Carlisle: ${carlisleEvents.length}`);
  console.log(`Latest source refresh: ${metadata.refreshedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
