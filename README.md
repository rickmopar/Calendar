# Car Show Calendar

## Canonical Code

This folder is the source-of-truth Calendar app for the live GitHub Pages site:

https://rickmopar.github.io/Calendar/

The canonical Git remote is:

https://github.com/rickmopar/Calendar.git

If another Codex chat creates a separate calendar folder, compare it against this repository before publishing. The known-good v24 code includes the Assistant, Interested checkboxes, manual show entry, deadline date picker, and PDF export.

Open `index.html` to view the calendar when the whole folder is together.

If you want one file that opens more reliably in Chrome after downloading from Google Drive, use `car-show-calendar.html`.

The calendar shows only events from the current date forward. The saved dataset still keeps the full 2026 source pull so the view can roll forward automatically as dates pass.

## Apple Calendar: Interested → iCloud

The dashboard **does not** subscribe users to the full car show catalogue.
The old all-events subscription has been disabled and its feed emptied.

To send selected events to Apple Calendar, check **Interested** for those
shows, then tap **Add Interested to Apple Calendar** in the Interested section.
The dashboard opens a local Apple Shortcut using the officially documented
`shortcuts://run-shortcut` URL scheme and passes a JSON payload with
**only the checked event occurrences**. Event data includes title, start/end
time, all-day flag, location and short notes. No account credentials, other
private events, or passwords are transmitted.

### One-time Apple Shortcuts setup

The browser cannot use the native EventKit calendar API. Create a Shortcut
named exactly `CCCHR Add to Apple Calendar` in Shortcuts on the iPhone/iPad
(or Mac):

1. **Get Dictionary from Input** from Shortcut Input.
2. **Get Dictionary Value** with key `events` (a list).
3. **Repeat with Each** for that list.
4. In the repeat, **Get Dictionary Value** from Repeat Item for `title`,
   `start`, `end`, and `location`. Store each in distinct variables.
5. Convert `start` and `end` into dates with **Get Dates from Input**,
   and set them into **Add New Event**, along with title and location.
6. Set **Add New Event** to write to an editable iCloud calendar, and turn
   off the compose sheet if desired.
7. If desired, use the `allDay` flag to distinguish all-day events and
   **Find Calendar Events** before creation to avoid creating duplicates.

Once installed, one tap in the web app launches the on-device Shortcut.
This is a bridge into the user's own Apple Calendar, **not** a direct web
API call. The website cannot verify that iCloud actually saved the events.
The user must approve any Calendar access requested by Shortcuts.

Large selections fall back to Apple's `input=clipboard` shortcut scheme
with a browser clipboard permission. There is no automatic continuous sync.
Deselecting Interested does not delete previously added iCloud events.

## Google Sheets Sync

A starter Google Sheet for Assistant sync was created here:

https://docs.google.com/spreadsheets/d/1sWi7fl6_Xplq7dV1c_OI-TpbUfT4efOeS0qcL8Q5DSs/edit

The calendar includes an optional Assistant Sync panel. To enable cross-device sync, open that Sheet, choose `Extensions > Apps Script`, paste `google-apps-script/Code.gs`, deploy it as a Web App, then paste the Web App URL into the calendar with a private sync code. Full setup notes are in `google-apps-script/README.md`.

## Mobile App

Open the local or hosted `index.html` page on a phone, then use the browser's "Add to Home Screen" or "Install App" option. The app includes a web app manifest and service worker so the dashboard opens in standalone mode and keeps the latest loaded calendar available offline.

## Refresh the Data

Run either command from this folder:

```sh
node scripts/refresh-events.js
```

or, on a Mac, double-click `refresh.command`.

The refresh script downloads the latest CCCHR, AACA, and Carlisle source URLs, rebuilds `data/events-2026.json`, and updates the "Last refreshed" date shown at the top of the calendar. It also scans AACA PDF flyers for registration deadline language and saves those deadline notes with the matching events.

PDF scanning uses Python's `pypdf` package. Install it once with:

```sh
python3 -m pip install --user pypdf
```

The CCCHR Facebook events page is included as a visible source link and metadata source. Facebook does not expose public event records to this refresh script without an authenticated API or browser session, so automated event records still come from the CCCHR website feed plus AACA and Carlisle.

## Website and private event management (v29)

Public navigation now has Upcoming, Calendar, and My picks. Select View details or a calendar entry for directions, organizer links, and calendar download. Existing browser-local picks, notes, manual entries, and optional Sheets sync keep their storage keys.

The TRAACA importer now honors explicit month/year headings. It previously attached 2027 entries to December 2026. The saved TRAACA listings have been reparsed from the existing source snapshot; this is a date correction, not a claim of a fresh source fetch.

### Private manager

Requires Python 3.9+ and Node.js. On the intended management host, run:

```sh
python3 server.py --setup
python3 server.py
```

Set a manager username and a password of at least 12 characters. Open http://127.0.0.1:8770/manage.html. Accounts and persistent edits are stored in `.calendar-admin/`, excluded from Git. Back up this directory as well as `data/`. Never commit it. The server exposes only an explicit allowlist of public files; account files, source code, and management state are not served.

The manager supports adding, editing, reviewing, hiding, and restoring events. Draft/review and hidden records do not appear publicly. Imported records remain public and explicitly unreviewed until checked. Marking a record reviewed requires a source link; this is a human review, not an automatic verification claim. Corrections match later imports by original source, title, and date, with the event ID retained for saved picks. Index-only ID changes do not restore hidden records. A changed source title or date may need a new review. Date/time editing uses Eastern time. Multi-day dates are preserved when the start date stays unchanged; changing the start date converts the listing to a single-day event.

`data/imported-events.json` is the imported baseline. Refresh writes this baseline then applies `.calendar-admin/state.json` through `scripts/publish-managed.js`. Keep refresh and manager writes from running concurrently. To use a separate state location, set `CALENDAR_ADMIN_DATA` for the Python server and `CALENDAR_STATE` to its `state.json` for the refresh process.

The management server binds to loopback. To reach it remotely, configure an **unused** Tailscale Serve HTTPS port pointing at `http://127.0.0.1:8770`, with access restricted to the calendar manager. Preserve the existing tracker on 443 and TRAACA on 8443. Do not reuse either port. Use HTTPS for remote sign-in. Add any custom hostname to `CALENDAR_ALLOWED_HOSTS`. No mini configuration has been changed by this code update.

Saving updates the public files on the management host. GitHub Pages receives them only after an explicit Git deployment. Public visitors' local picks and notes are not shared with the manager. A background launch service and automatic Git publishing are not configured yet; those require verified access to the mini and a chosen deployment credential.

After a source refresh or management edits, regenerate the downloadable single file with `node scripts/build-standalone.js`.
