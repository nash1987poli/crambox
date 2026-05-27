// ============================================================
// CramBox Activation — Google Apps Script
// ============================================================
// SETUP:
// 1. Create a Google Sheet with a tab named "Codes"
// 2. Row 1 headers: Code | Name | Status | Device | Activated
// 3. Add codes in Column A, student names in Column B
// 4. Open Extensions > Apps Script, paste this code
// 5. Deploy > New Deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Copy the Web App URL into CramBox (SHEET_SCRIPT_URL)
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

    return jsonResponse({ valid: false, error: 'Unknown action' });

  } catch (err) {
    return jsonResponse({ valid: false, error: 'Server error: ' + err.message });
  }
}

function handleValidate(sheet, code, fp) {
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var sheetCode = String(rows[i][0]).toUpperCase().trim();
    if (sheetCode !== code) continue;

    var name = rows[i][1] || 'Student';
    var status = String(rows[i][2]).toUpperCase().trim();
    var existingFp = String(rows[i][3]).trim();

    // Already used
    if (status === 'USED') {
      if (existingFp === fp) {
        // Same device — allow re-activation
        return jsonResponse({ valid: true, name: name, status: 'already_activated' });
      }
      // Different device — blocked
      return jsonResponse({ valid: false, error: 'Code already used on another device' });
    }

    // Activate: mark as used
    var row = i + 1;
    sheet.getRange(row, 3).setValue('USED');
    sheet.getRange(row, 4).setValue(fp);
    sheet.getRange(row, 5).setValue(new Date().toISOString());

    return jsonResponse({ valid: true, name: name, status: 'activated' });
  }

  return jsonResponse({ valid: false, error: 'Invalid code' });
}

function doGet(e) {
  // GET requests should not perform validation — codes must not appear in URLs.
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
  var code = 'CRAM-' + String(row).padStart(4, '0');
  codeCell.setValue(code);
}
