# Google Sheets Assistant Sync

Use this folder to connect the Calendar Assistant to Google Sheets. The calendar still works locally without sync.

## Setup

Use this route if the Google Sheet does not show `Extensions > Apps Script`.

1. Go to https://script.google.com/home
2. Click `New project`.
3. Delete the starter code.
4. Paste the contents of `Code.gs`.
5. Click `Save`.
6. Click `Deploy > New deployment`.
7. Choose type `Web app`.
8. Set `Execute as` to `Me`.
9. Set `Who has access` to `Anyone`.
10. Click `Deploy`, approve access, then copy the Web app URL.
11. Open the calendar, expand `Assistant Sync`, paste the Web app URL, enter a private sync code, and click `Save Settings`.

The script points directly to this Google Sheet ID:

`1sWi7fl6_Xplq7dV1c_OI-TpbUfT4efOeS0qcL8Q5DSs`

## How It Works

The Google Sheet stores one row per private sync code. The payload includes:

- Interested event IDs
- Event notes
- Manual shows

Anyone who has both the web app URL and the private sync code can read or update that sync row, so keep the code private.

## Recommended Sync Code

Use something private and memorable, not a password you use anywhere else. Example:

`rick-car-shows-2026`
