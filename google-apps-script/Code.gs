const SPREADSHEET_ID = "1sWi7fl6_Xplq7dV1c_OI-TpbUfT4efOeS0qcL8Q5DSs";
const SHEET_NAME = "AssistantData";
const HEADERS = ["syncCode", "payload", "updatedAt", "device", "version"];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = cleanCallbackName(params.callback || "");
  const code = String(params.code || "").trim();

  if (params.action !== "load") {
    return output({ ok: false, error: "Unknown action." }, callback);
  }

  if (!code) {
    return output({ ok: false, error: "Missing sync code." }, callback);
  }

  const row = findRowByCode(code);
  if (!row) {
    return output({ ok: true, data: null }, callback);
  }

  let data = null;
  try {
    data = JSON.parse(row.payload || "null");
  } catch (err) {
    return output({ ok: false, error: "Saved payload is not valid JSON." }, callback);
  }

  return output({
    ok: true,
    data,
    updatedAt: row.updatedAt,
    device: row.device,
  }, callback);
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents || "{}");
  } catch (err) {
    return output({ ok: false, error: "Post body is not valid JSON." });
  }

  const code = String(body.code || "").trim();
  if (!code) {
    return output({ ok: false, error: "Missing sync code." });
  }

  const data = body.data || {};
  upsertRow(code, JSON.stringify(data), body.device || "Calendar browser", data.version || 1);
  return output({ ok: true, updatedAt: new Date().toISOString() });
}

function output(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanCallbackName(value) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(value) ? value : "";
}

function getSheet() {
  const spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => firstRow[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowByCode(code) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const found = rows.find((row) => String(row[0]).trim() === code);
  if (!found) return null;

  return {
    syncCode: found[0],
    payload: found[1],
    updatedAt: found[2],
    device: found[3],
    version: found[4],
  };
}

function upsertRow(code, payload, device, version) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    const updatedAt = new Date().toISOString();
    const values = [code, payload, updatedAt, device, version];

    if (lastRow >= 2) {
      const codes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const index = codes.findIndex((row) => String(row[0]).trim() === code);
      if (index >= 0) {
        sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([values]);
        return;
      }
    }

    sheet.appendRow(values);
  } finally {
    lock.releaseLock();
  }
}
