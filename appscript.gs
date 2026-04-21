/**
 * Disha-Unis GAS Backend — Full CRUDI Operations
 * Deploy as: Execute as Me | Who has access: Anyone
 * No auth — security is handled at the dashboard layer (Clerk).
 *
 * SUPPORTED ACTIONS
 * ─────────────────
 * GET  getSheets?targetSlug=xxx    → list meta for a slug (or all)
 * GET  getSheetData?sheetName=xxx  → all rows as JSON objects
 * GET  getSlugs                    → all unique university slugs
 * GET  getRow?sheetName=xxx&rowIndex=N → single row (1-based, not counting header)
 *
 * POST { action:"importSheet", data:{...} }  → bulk CSV import (upserts tab)
 * POST { action:"createRow",  sheetName, row:{} }      → append row
 * POST { action:"updateRow",  sheetName, rowIndex, row:{} } → update row by index
 * POST { action:"deleteRow",  sheetName, rowIndex }    → delete row by index
 * POST { action:"deleteSheet", sheetName }             → drop entire tab + meta
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeaders(sheet) {
  if (sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

// Convert a plain object → array in header order, filling blanks for unknowns
function rowToArray(headers, rowObj) {
  return headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : ''));
}

// ── GET handler ───────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProp = PropertiesService.getScriptProperties();

  // List sheet metadata (optionally filtered by universitySlug)
  if (action === 'getSheets') {
    const targetSlug = e.parameter.targetSlug;
    const meta = JSON.parse(scriptProp.getProperty('sheets_meta') || '[]');
    const result = targetSlug ? meta.filter(s => s.targetSlug === targetSlug) : meta;
    return json(result);
  }

  // Get all rows from a tab as array of objects
  if (action === 'getSheetData') {
    const sheetName = e.parameter.sheetName;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return json([]);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const rows = values.slice(1).map((row, i) =>
      Object.assign({ _rowIndex: i + 1 }, Object.fromEntries(headers.map((h, j) => [h, row[j]])))
    );
    return json(rows);
  }

  // List all unique university slugs that have data
  if (action === 'getSlugs') {
    const meta = JSON.parse(scriptProp.getProperty('sheets_meta') || '[]');
    const slugs = [...new Set(meta.map(s => s.targetSlug))];
    return json(slugs);
  }

  // Get a single row by 1-based rowIndex (not counting header)
  if (action === 'getRow') {
    const sheetName = e.parameter.sheetName;
    const rowIndex = parseInt(e.parameter.rowIndex, 10);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return json({ error: 'Sheet not found' });
    const headers = getHeaders(sheet);
    const rowValues = sheet.getRange(rowIndex + 1, 1, 1, headers.length).getValues()[0];
    const row = Object.fromEntries(headers.map((h, i) => [h, rowValues[i]]));
    return json({ _rowIndex: rowIndex, ...row });
  }

  return json({ error: 'Unknown GET action' });
}

// ── POST handler ──────────────────────────────────────────────────────────────

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProp = PropertiesService.getScriptProperties();

  // ── IMPORT (bulk CSV upload, replaces tab) ──────────────────────────────────
  if (action === 'importSheet') {
    const sheetData = body.data; // { id, name, targetSlug, uploadedAt, headers[], rows[] }
    const sheetName = sheetData.targetSlug || 'General';

    // Upsert meta — replace any existing entry for this slug
    let meta = JSON.parse(scriptProp.getProperty('sheets_meta') || '[]');
    meta = meta.filter(s => s.targetSlug !== sheetData.targetSlug);
    meta.push({
      id:          sheetData.id,
      name:        sheetData.name,
      targetSlug:  sheetData.targetSlug,
      uploadedAt:  sheetData.uploadedAt,
      headers:     sheetData.headers,
      rowCount:    sheetData.rows.length,
    });
    scriptProp.setProperty('sheets_meta', JSON.stringify(meta));

    // Create or replace the physical tab
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();

    const allData = [
      sheetData.headers,
      ...sheetData.rows.map(row => sheetData.headers.map(h => row[h] ?? '')),
    ];
    sheet.getRange(1, 1, allData.length, sheetData.headers.length).setValues(allData);

    return json({ success: true, rowCount: sheetData.rows.length, sheetName });
  }

  // ── CREATE — append a new row ───────────────────────────────────────────────
  if (action === 'createRow') {
    const { sheetName, row } = body;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return json({ error: 'Sheet not found' });

    const headers = getHeaders(sheet);
    sheet.appendRow(rowToArray(headers, row));

    // Update rowCount in meta
    _updateMetaRowCount(scriptProp, sheetName, sheet.getLastRow() - 1);

    return json({ success: true, rowIndex: sheet.getLastRow() - 1 });
  }

  // ── UPDATE — overwrite a row by 1-based rowIndex (not counting header) ──────
  if (action === 'updateRow') {
    const { sheetName, rowIndex, row } = body;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return json({ error: 'Sheet not found' });

    const headers = getHeaders(sheet);
    const sheetRowNum = rowIndex + 1; // +1 to skip header
    sheet.getRange(sheetRowNum, 1, 1, headers.length).setValues([rowToArray(headers, row)]);

    return json({ success: true, rowIndex });
  }

  // ── DELETE — remove a row by 1-based rowIndex (not counting header) ─────────
  if (action === 'deleteRow') {
    const { sheetName, rowIndex } = body;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return json({ error: 'Sheet not found' });

    sheet.deleteRow(rowIndex + 1); // +1 to skip header

    // Update rowCount in meta
    const remaining = sheet.getLastRow() - 1;
    _updateMetaRowCount(scriptProp, sheetName, remaining);

    return json({ success: true, remaining });
  }

  // ── DELETE SHEET — remove entire tab + meta entry ───────────────────────────
  if (action === 'deleteSheet') {
    const { sheetName } = body;
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) ss.deleteSheet(sheet);

    let meta = JSON.parse(scriptProp.getProperty('sheets_meta') || '[]');
    meta = meta.filter(s => s.targetSlug !== sheetName);
    scriptProp.setProperty('sheets_meta', JSON.stringify(meta));

    return json({ success: true, deleted: sheetName });
  }

  return json({ error: 'Unknown POST action' });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _updateMetaRowCount(scriptProp, sheetName, count) {
  let meta = JSON.parse(scriptProp.getProperty('sheets_meta') || '[]');
  const idx = meta.findIndex(s => s.targetSlug === sheetName);
  if (idx >= 0) {
    meta[idx].rowCount = count;
    scriptProp.setProperty('sheets_meta', JSON.stringify(meta));
  }
}