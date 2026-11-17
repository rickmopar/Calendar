"use strict";
// Publishes the same reviewed event catalogue as the dashboard as a read-only
// iCalendar feed. Apple Calendar subscribers receive updates to this file.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "calendar-subscribe.ics");

function icalText(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// RFC 5545: folded content lines are no longer than 75 octets.
function fold(line) {
  const lines = [];
  let part = "";
  let length = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, "utf8");
    if (length + bytes > 75) {
      lines.push(part);
      part = " ";
      length = 1;
    }
    part += char;
    length += bytes;
  }
  lines.push(part);
  return lines.join("\r\n");
}

function utcStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function utcDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function followingDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return utcDay(date);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (_) {
    return "";
  }
}

function locationText(event) {
  const venue = String(event.venue || "").trim();
  const address = String(event.address || "").trim();
  if (!venue) return address;
  if (!address) return venue;
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalize(venue) === normalize(address)) return venue;
  return venue + ", " + address;
}

function buildFeed(events, metadata = {}) {
  const stamp = utcStamp(metadata.publishedAt || metadata.refreshedAt) || utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CCCHR Dashboard//Car Show Calendar Subscription//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Car Show Calendar",
    "X-WR-CALDESC:Published CCCHR\\, TRAACA\\, AACA and other car events",
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];
  const seen = new Set();
  for (const event of events) {
    if (!event || !event.id || !event.title) continue;
    const uid = String(event.id).replace(/[^a-zA-Z0-9_.-]/g, "-") + "@ccchr-dashboard.local";
    if (seen.has(uid)) continue;
    const start = event.allDay ? utcDay(event.startDate) : utcStamp(event.startDate);
    const end = event.allDay ? followingDay(event.endDate || event.startDate) : utcStamp(event.endDate || event.startDate);
    if (!start || !end || end < start) continue;
    seen.add(uid);
    const sourceUrl = safeUrl(event.url || event.sourceUrl || event.calendarUrl || "");
    const description = [event.description, sourceUrl].filter(Boolean).join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + stamp,
      event.allDay ? "DTSTART;VALUE=DATE:" + start : "DTSTART:" + start,
      event.allDay ? "DTEND;VALUE=DATE:" + end : "DTEND:" + end,
      "SUMMARY:" + icalText(event.title),
    );
    const location = locationText(event);
    if (location) lines.push("LOCATION:" + icalText(location));
    if (description) lines.push("DESCRIPTION:" + icalText(description));
    if (sourceUrl) lines.push("URL:" + sourceUrl);
    // The source catalogue already contains individual occurrences. Do not
    // guess RRULE from prose; that would create duplicate/phantom shows.
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function publish(events, metadata) {
  const output = buildFeed(events, metadata);
  fs.writeFileSync(OUTPUT + ".tmp", output, "utf8");
  fs.renameSync(OUTPUT + ".tmp", OUTPUT);
  return { count: (output.match(/BEGIN:VEVENT/g) || []).length, bytes: Buffer.byteLength(output) };
}

module.exports = { buildFeed, publish };
if (require.main === module) {
  const events = JSON.parse(fs.readFileSync(path.join(ROOT, "data/events-2026.json"), "utf8"));
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, "data/metadata.json"), "utf8"));
  const result = publish(events, metadata);
  console.log("Built calendar-subscribe.ics:", result.count, "events,", result.bytes, "bytes");
}
