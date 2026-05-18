# Car Show Calendar

Open `index.html` to view the calendar when the whole folder is together.

If you want one file that opens more reliably in Chrome after downloading from Google Drive, use `car-show-calendar.html`.

The calendar shows only events from the current date forward. The saved dataset still keeps the full 2026 source pull so the view can roll forward automatically as dates pass.

## Mobile App

Open the local or hosted `index.html` page on a phone, then use the browser's "Add to Home Screen" or "Install App" option. The app includes a web app manifest and service worker so the dashboard opens in standalone mode and keeps the latest loaded calendar available offline.

## Refresh the Data

Run either command from this folder:

```sh
node scripts/refresh-events.js
```

or, on a Mac, double-click `refresh.command`.

The refresh script downloads the latest CCCHR, AACA, and Carlisle source URLs, rebuilds `data/events-2026.json`, and updates the "Last refreshed" date shown at the top of the calendar.
