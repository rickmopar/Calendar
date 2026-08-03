# Google Sheets Assistant Sync

Use this folder to connect the Calendar Assistant to Google Sheets. The calendar still works locally without sync.

## Setup

1. Create or open a Google Sheet named `Car Show Calendar Assistant`.
2. In the Sheet, choose `Extensions > Apps Script`.
3. Replace the starter code with the contents of `Code.gs`.
4. Click `Save`.
5. Click `Deploy > New deployment`.
6. Choose type `Web app`.
7. Set `Execute as` to `Me`.
8. Set `Who has access` to `Anyone`.
9. Click `Deploy`, approve access, then copy the Web app URL.
10. Open the calendar, expand `Assistant Sync`, paste the Web app URL, enter a private sync code, and click `Save Settings`.

## How It Works

The Google Sheet stores one row per private sync code. The payload includes:

- Interested event IDs
- Event notes
- Manual shows

Anyone who has both the web app URL and the private sync code can read or update that sync row, so keep the code private.

## Recommended Sync Code

Use something private and memorable, not a password you use anywhere else. Example:

`rick-car-shows-2026`
