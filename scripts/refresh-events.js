const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const rawDir = path.join(root, "raw");
const sourceUrl = "https://www.ccchr.org/events?format=json";
const aacaSourceUrl = "https://aaca.org/aacanationalshowsandtourscalendar/";
const traacaSourceUrl = "https://www.traaca.com/calendar.htm";
const carlisleSourceUrl = "https://carlisleevents.com/events";
const facebookSourceUrl = "https://www.facebook.com/ccchr/events";
const years = [2026, 2027];
const year = years[0];

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

async function fetchTextWithCache(url, cacheFile) {
  try {
    return await fetchText(url);
  } catch (error) {
    const cached = path.join(rawDir, cacheFile);
    if (fs.existsSync(cached)) {
      console.warn(`Using cached ${cacheFile}: ${error.message}`);
      return fs.readFileSync(cached, "utf8");
    }
    throw error;
  }
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

function normalizeTraacaType(title) {
  if (/show/i.test(title)) return "Car show";
  if (/brunch|dinner|meeting|cookoff|auction/i.test(title)) return "Meetup";
  if (/tour/i.test(title)) return "Tour";
  return "TRAACA event";
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
  if (!years.includes(eventYear)) return null;

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
  if (!years.includes(eventYear)) return null;

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

function stripTags(value) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function easternOffsetHours(month, day) {
  if (month < 2 || month > 10) return 5;
  if (month > 2 && month < 10) return 4;

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstSunday = 1 + ((7 - firstOfMonth.getUTCDay()) % 7);
  const transitionDay = month === 2 ? firstSunday + 7 : firstSunday;
  return month === 2
    ? day >= transitionDay ? 4 : 5
    : day < transitionDay ? 4 : 5;
}

function easternDateToIso(month, day, hour = 9, minute = 0) {
  const offset = easternOffsetHours(month, day);
  return new Date(Date.UTC(year, month, day, hour + offset, minute)).toISOString();
}

function parseTraacaTime(text) {
  const matches = [...text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi)];
  if (!matches.length) return { hour: 9, minute: 0, label: "All day", allDay: true };

  const toTime = (match) => {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3].toUpperCase();
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return { hour, minute };
  };

  const start = toTime(matches[0]);
  const end = matches[1] ? toTime(matches[1]) : { hour: start.hour + 2, minute: start.minute };
  return { ...start, endHour: end.hour, endMinute: end.minute, label: stripTags(matches[0][0]), allDay: false };
}

function parseTraacaRange(value, currentMonth) {
  const match = stripTags(value).match(/^(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*-\s*(.+)$/);
  if (!match || currentMonth === undefined) return null;
  return {
    startDay: Number(match[1]),
    endDay: Number(match[2] || match[1]),
    text: match[3].trim(),
  };
}

function extractTraacaCity(text) {
  if (/Virginia Beach/i.test(text)) return "Virginia Beach";
  if (/Chesapeake/i.test(text)) return "Chesapeake";

  const cityMatches = [...text.matchAll(/\b([A-Z][A-Za-z .'-]+),\s*(VA|NC|PA|Delaware|DE)\b/g)];
  if (cityMatches.length) return cityMatches.at(-1)[1].replace(/\bW\.$/, "West").trim();
  return "Hampton Roads";
}

function normalizeTraacaEvent(li, month, index) {
  if (/color=["']?#0000FF/i.test(li)) return null;
  if (/\bNo\s+TRAACA\b/i.test(stripTags(li))) return null;

  const range = parseTraacaRange(li, month);
  if (!range) return null;

  const time = parseTraacaTime(range.text);
  const startDate = easternDateToIso(month, range.startDay, time.hour, time.minute);
  const endDate = time.allDay
    ? easternDateToIso(month, range.endDay, time.hour, time.minute)
    : easternDateToIso(month, range.endDay, time.endHour, time.endMinute);
  const title = range.text.split(/\s+-\s+/)[0].replace(/\s+\(.+$/, "").trim() || "TRAACA Event";
  const description = stripTags(li);
  const city = extractTraacaCity(description);
  const venueMatch = description.match(/\(([^()]*?(?:Center|Convention Center|Country Club|Drive|Road|Rd\.|Ave|Avenue)[^()]*)\)/i);
  const venue = venueMatch ? venueMatch[1].trim() : "TRAACA";

  return {
    id: `traaca-${year}-${month + 1}-${range.startDay}-${index}`,
    title,
    startDate,
    endDate,
    allDay: time.allDay,
    month: new Date(startDate).toLocaleString("en-US", { month: "long", timeZone: "America/New_York" }),
    weekday: new Date(startDate).toLocaleString("en-US", { weekday: "short", timeZone: "America/New_York" }),
    dateLabel: new Date(startDate).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    }),
    timeLabel: time.label,
    type: normalizeTraacaType(title),
    source: "TRAACA",
    city,
    venue,
    address: venueMatch ? venueMatch[1].trim() : city,
    description,
    sourceUrl: traacaSourceUrl,
    url: traacaSourceUrl,
    image: "",
  };
}

async function fetchTraacaEvents() {
  const html = await fetchTextWithCache(traacaSourceUrl, "traaca-calendar.html");
  fs.writeFileSync(path.join(rawDir, "traaca-calendar.html"), html);

  const events = [];
  let currentMonth;
  let index = 0;
  const tokenPattern = /<p><b>([A-Z]+)<\/b><\/p>|<li\b[^>]*>[\s\S]*?<\/li>/gi;
  let match;

  while ((match = tokenPattern.exec(html))) {
    if (match[1]) {
      currentMonth = monthNumber(match[1]);
      continue;
    }

    const event = normalizeTraacaEvent(match[0], currentMonth, index);
    if (event) {
      events.push(event);
      index += 1;
    }
  }

  return events;
}

async function fetchAacaEvents() {
  const html = await fetchTextWithCache(aacaSourceUrl, "aaca-national-calendar.html");
  fs.writeFileSync(path.join(rawDir, "aaca-national-calendar.html"), html);

  const events = [];
  const strongPattern = /<strong\b[^>]*>([\s\S]*?)<\/strong>/gi;
  let match;
  let index = 0;

  while ((match = strongPattern.exec(html))) {
    const block = match[1];
    const linkMatch = block.match(/href="([^"]+)"/i);
    const lines = decodeHtml(block)
      .split(/\s+\|\s+/)
      .map((line) => line.trim())
      .filter((line) => years.some((eventYear) => new RegExp(`\\b${eventYear}\\b`).test(line)));

    for (const line of lines) {
      const event = normalizeAacaEvent(line, linkMatch ? decodeHtml(linkMatch[1]) : aacaSourceUrl, index);
      if (event) {
        events.push(event);
        index += 1;
      }
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
  const html = await fetchTextWithCache(carlisleSourceUrl, "carlisle-events.html");
  fs.writeFileSync(path.join(rawDir, "carlisle-events.html"), html);

  const blocks = html.split(/<div class="event">/i).slice(1);
  return blocks
    .map((block, index) => normalizeCarlisleEvent(block, index))
    .filter(Boolean);
}

function duplicateKey(event) {
  const source = event.source || "";
  if (source !== "TRAACA" && source !== "AACA") return "";
  const day = event.startDate.slice(0, 10);
  const title = String(event.title || "")
    .toLowerCase()
    .replace(/\baaca\b|\btraaca\b|\bannual\b|\bthe\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${day}|${title}`;
}

function mergeEventsWithAacaPriority(groups) {
  const merged = [];
  const aacaKeys = new Set(groups.AACA.map(duplicateKey).filter(Boolean));

  for (const event of [...groups.CCCHR, ...groups.AACA, ...groups.TRAACA, ...groups.Carlisle]) {
    const key = duplicateKey(event);
    if (event.source === "TRAACA" && key && aacaKeys.has(key)) continue;
    merged.push(event);
  }

  return merged;
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const seen = new Set();
  const all = [];
  let url = sourceUrl;
  let page = 1;

  while (url && page <= 40) {
    let json;
    try {
      json = await fetchJson(url);
    } catch (error) {
      const cached = path.join(rawDir, `ccchr-events-page-${page}.json`);
      if (!fs.existsSync(cached)) throw error;
      console.warn(`Using cached ccchr-events-page-${page}.json: ${error.message}`);
      json = JSON.parse(fs.readFileSync(cached, "utf8"));
    }
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
    .filter((event) => years.includes(new Date(event.startDate).getFullYear()))
    .map(normalize);
  const aacaEvents = await fetchAacaEvents();
  const traacaEvents = await fetchTraacaEvents();
  const carlisleEvents = await fetchCarlisleEvents();
  const events = mergeEventsWithAacaPriority({
    CCCHR: ccchrEvents,
    AACA: aacaEvents,
    TRAACA: traacaEvents,
    Carlisle: carlisleEvents,
  })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const metadata = {
    sources: [
      "https://www.ccchr.org/events",
      aacaSourceUrl,
      traacaSourceUrl,
      carlisleSourceUrl,
      facebookSourceUrl,
    ],
    sourceCalendar: "https://www.ccchr.org/calendar",
    aacaSourceCalendar: aacaSourceUrl,
    traacaSourceCalendar: traacaSourceUrl,
    carlisleSourceCalendar: carlisleSourceUrl,
    facebookSourceCalendar: facebookSourceUrl,
    sourceNotes: {
      Facebook: "Linked as a source page; Facebook does not expose public event records to the refresh script without an authenticated API or browser session.",
    },
    years,
    year,
    refreshedAt: new Date().toISOString(),
    totalEvents: events.length,
    sourceCounts: {
      CCCHR: ccchrEvents.length,
      AACA: aacaEvents.length,
      TRAACA: traacaEvents.length,
      Carlisle: carlisleEvents.length,
    },
  };

  fs.writeFileSync(path.join(dataDir, "events-2026.json"), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(dataDir, "metadata.json"), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(
    path.join(dataDir, "events-2026.js"),
    `window.CCCHR_EVENTS_2026 = ${JSON.stringify(events, null, 2)};\nwindow.CCCHR_METADATA = ${JSON.stringify(metadata, null, 2)};\n`,
  );

  console.log(`Refreshed ${events.length} events for ${years.join("-")}.`);
  console.log(`CCCHR: ${ccchrEvents.length}; AACA: ${aacaEvents.length}; TRAACA: ${traacaEvents.length}; Carlisle: ${carlisleEvents.length}`);
  console.log(`Latest source refresh: ${metadata.refreshedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
