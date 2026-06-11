// ============================================================
// CramBox Activation — Google Apps Script
// ============================================================
// SETUP:
// 1. Create a Google Sheet with a tab named "Codes"
// 2. Row 1 headers: Code | Name | Status | Device | Activated | MaxDevices | Email
//    (Email column G is used by the automated 'issue' endpoint + n8n nudges)
// 3. Add codes in Column A, student names in Column B
// 4. Open Extensions > Apps Script, paste this code
// 5. Deploy > New Deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Copy the Web App URL into CramBox (SHEET_SCRIPT_URL)
//
// SQUAD CODES (multi-device):
//   - Column F "MaxDevices" sets how many phones one code unlocks.
//   - Leave it BLANK or 1 for a normal solo code ($5).
//   - Set it to 3 for a Squad-3 code ($12), or 5 for a Squad-5 code ($18).
//   - Column D auto-fills with the devices that have activated (comma-separated).
//   - Status shows ACTIVE while spots remain, USED once the squad is full.
//   - Existing solo codes (no Column F) keep working exactly as before.
// ============================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Codes');
    if (!sheet) {
      return jsonResponse({ valid: false, error: 'Sheet "Codes" not found' });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var code = (data.code || '').toUpperCase().trim();
    var fp = data.fp || '';

    if (action === 'validate') {
      return handleValidate(sheet, code, fp);
    }

    // Automated code issuing (called by n8n, not by the app). Secured by ISSUE_SECRET.
    if (action === 'issue') {
      return handleIssue(sheet, data);
    }

    // Returns the list of activated students (name + email) for the daily nudge. Secured.
    if (action === 'nudgeList') {
      return handleNudgeList(sheet, data);
    }

    // Block (or un-block) a code from future activations. Secured.
    if (action === 'block') {
      return handleBlock(sheet, data);
    }

    return jsonResponse({ valid: false, error: 'Unknown action' });

  } catch (err) {
    return jsonResponse({ valid: false, error: 'Server error: ' + err.message });
  }
}

// ====== AUTOMATED CODE ISSUING (for n8n) ======
// IMPORTANT: change this secret to your own random string, and use the SAME value in n8n.
// It stops anyone but your n8n workflow from minting free codes.
var ISSUE_SECRET = 'CHANGE-ME-to-a-long-random-string';

// A referrer earns a reward every REWARD_EVERY paid referrals (you pay out via EcoCash).
var REWARD_EVERY = 3;

function handleIssue(sheet, data) {
  if (String(data.key || '') !== ISSUE_SECRET) {
    return jsonResponse({ ok: false, error: 'Unauthorized' });
  }
  var name = String(data.name || 'Student').trim();
  var email = String(data.email || '').trim();
  var referredBy = String(data.referredBy || '').toUpperCase().trim();
  var maxDevices = parseInt(data.maxDevices, 10);
  if (!maxDevices || maxDevices < 1) maxDevices = 1;

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return jsonResponse({ ok: false, error: 'Server busy, try again' }); }
  try {
    // Generate a code that is not already in the sheet.
    var rows = sheet.getDataRange().getValues();
    var existing = {};
    for (var i = 1; i < rows.length; i++) { existing[String(rows[i][0]).toUpperCase().trim()] = true; }
    var code, tries = 0;
    do { code = 'CB-' + randomAlphanumeric(8); tries++; } while (existing[code] && tries < 50);

    // Columns: A Code | B Name | C Status | D Device | E Activated | F MaxDevices | G Email | H ReferredBy | I Referrals | J RewardDue
    sheet.appendRow([code, name, '', '', '', maxDevices, email, referredBy, 0, '']);

    // Credit the referrer (if a valid existing code was given).
    var referralStatus = '';
    var referrerCount = 0;
    if (referredBy && existing[referredBy]) {
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][0]).toUpperCase().trim() === referredBy) {
          referrerCount = (parseInt(rows[r][8], 10) || 0) + 1;   // column I (index 8)
          var rowNum = r + 1;
          sheet.getRange(rowNum, 9).setValue(referrerCount);     // I = Referrals
          if (referrerCount % REWARD_EVERY === 0) {
            sheet.getRange(rowNum, 10).setValue('REWARD DUE (' + referrerCount + ' referrals)'); // J
            referralStatus = 'reward_due';
          } else {
            referralStatus = 'counted';
          }
          break;
        }
      }
    }
    SpreadsheetApp.flush();

    return jsonResponse({ ok: true, code: code, name: name, email: email, maxDevices: maxDevices,
      referredBy: referredBy, referralStatus: referralStatus, referrerCount: referrerCount });
  } finally {
    lock.releaseLock();
  }
}

// Returns activated students with an email, for the n8n daily nudge.
// "Activated" = a device has registered against the code (column D) AND an email exists (column G).
function handleNudgeList(sheet, data) {
  if (String(data.key || '') !== ISSUE_SECRET) {
    return jsonResponse({ ok: false, error: 'Unauthorized' });
  }
  var rows = sheet.getDataRange().getValues();
  var seen = {};
  var students = [];
  for (var i = 1; i < rows.length; i++) {
    var name = rows[i][1] || 'Student';
    var device = String(rows[i][3] || '').trim();
    var email = String(rows[i][6] || '').trim();
    if (email && device && !seen[email.toLowerCase()]) {
      seen[email.toLowerCase()] = true;
      students.push({ name: name, email: email });
    }
  }
  return jsonResponse({ ok: true, count: students.length, students: students });
}

// Block (or un-block with {unblock:true}) a code so it can't activate new devices.
function handleBlock(sheet, data) {
  if (String(data.key || '') !== ISSUE_SECRET) {
    return jsonResponse({ ok: false, error: 'Unauthorized' });
  }
  var code = String(data.code || '').toUpperCase().trim();
  if (!code) return jsonResponse({ ok: false, error: 'No code given' });
  var unblock = (data.unblock === true || String(data.unblock) === 'true');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return jsonResponse({ ok: false, error: 'Server busy, try again' }); }
  try {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toUpperCase().trim() === code) {
        sheet.getRange(i + 1, 3).setValue(unblock ? 'ACTIVE' : 'BLOCKED'); // column C = Status
        SpreadsheetApp.flush();
        return jsonResponse({ ok: true, code: code, status: unblock ? 'ACTIVE' : 'BLOCKED' });
      }
    }
    return jsonResponse({ ok: false, error: 'Code not found' });
  } finally {
    lock.releaseLock();
  }
}

function handleValidate(sheet, code, fp) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return jsonResponse({ valid: false, error: 'Server busy, try again' });
  }

  try {
    var rows = sheet.getDataRange().getValues();

    for (var i = 1; i < rows.length; i++) {
      var sheetCode = String(rows[i][0]).toUpperCase().trim();
      if (sheetCode !== code) continue;

      var name = rows[i][1] || 'Student';
      var status = String(rows[i][2]).toUpperCase().trim();
      var deviceField = String(rows[i][3] || '').trim();

      // BLOCKED code -> reject any activation (refund, abuse, etc.).
      // NOTE: this stops NEW activations. A device already activated keeps working offline
      // (the app does not re-check the server once unlocked).
      if (status === 'BLOCKED') {
        return jsonResponse({ valid: false, error: 'This code has been deactivated. Contact support.' });
      }

      // Column F (index 5) = MaxDevices for Squad codes. Empty/missing = 1 (solo, original behaviour).
      var maxDevices = parseInt(rows[i][5], 10);
      if (!maxDevices || maxDevices < 1) maxDevices = 1;

      // Devices are stored comma-separated in column D. A single legacy fp still parses to [fp].
      var devices = deviceField ? deviceField.split(',').map(function (s) { return s.trim(); }).filter(String) : [];

      // This device already registered on this code -> let it back in (offline-safe re-entry).
      if (devices.indexOf(fp) !== -1) {
        return jsonResponse({ valid: true, name: name, status: 'already_activated',
          slotsTotal: maxDevices, slotsUsed: devices.length });
      }

      // Manually disabled code (marked USED with no devices) -> treat as unavailable.
      if (status === 'USED' && devices.length === 0) {
        return jsonResponse({ valid: false, error: 'Code already used on another device' });
      }

      // Full?
      if (devices.length >= maxDevices) {
        var fullMsg = maxDevices === 1
          ? 'Code already used on another device'
          : 'This squad code is full — all ' + maxDevices + ' spots are taken.';
        return jsonResponse({ valid: false, error: fullMsg });
      }

      // Register this device (atomic within lock).
      devices.push(fp);
      var row = i + 1;
      // Mark USED only once every slot is filled; otherwise keep it open for the rest of the squad.
      sheet.getRange(row, 3).setValue(devices.length >= maxDevices ? 'USED' : 'ACTIVE');
      sheet.getRange(row, 4).setValue(devices.join(','));
      // Column E: record first activation if blank, else leave the original timestamp.
      if (!String(rows[i][4] || '').trim()) {
        sheet.getRange(row, 5).setValue(new Date().toISOString());
      }
      SpreadsheetApp.flush();

      return jsonResponse({ valid: true, name: name, status: 'activated',
        slotsTotal: maxDevices, slotsUsed: devices.length, slotsLeft: maxDevices - devices.length });
    }

    return jsonResponse({ valid: false, error: 'Invalid code' });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  // Validation is POST-only (JSON body) so activation codes never appear in URLs,
  // browser history, or Google's request logs. GET is a harmless health check.
  return jsonResponse({ status: 'ok', message: 'CramBox Activation API' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Codes') return;
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (col !== 2 || row <= 1) return;
  var codeCell = sheet.getRange(row, 1);
  if (codeCell.getValue() !== '') return;
  var code = 'CB-' + randomAlphanumeric(8);
  codeCell.setValue(code);
}

function randomAlphanumeric(len) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var result = '';
  for (var i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
