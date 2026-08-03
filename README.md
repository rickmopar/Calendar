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
