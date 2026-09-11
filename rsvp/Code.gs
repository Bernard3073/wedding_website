/**
 * RSVP collector for the Bo-Shiang & Suyi wedding site.
 *
 * Paste this into the Apps Script editor of a Google Sheet
 * (Extensions → Apps Script), deploy it as a Web App, and put the /exec URL
 * into RSVP_ENDPOINT in assets/js/main.js. Full steps are in README.md under
 * "Collecting and counting RSVPs".
 *
 * It keeps two tabs:
 *   RSVPs   — one row per guest, newest last
 *   Summary — live totals, including the headcount you actually plan around
 */

// Optional: get an email the moment someone replies. Set a Script Property
// named NOTIFY_EMAIL (Project Settings → Script Properties), with several
// addresses separated by commas. It lives there rather than here so the
// addresses stay out of the public repo. Leave it unset for no email.
var NOTIFY_EMAIL =
  PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || '';

var SHEET_RSVPS   = 'RSVPs';
var SHEET_SUMMARY = 'Summary';

// Guests is the whole party, children included. Children sits at the end, not
// beside Guests, so a Sheet that already holds replies keeps its columns.
var HEADERS = [
  'Timestamp', 'Name', 'Email', 'Attending', 'Guests',
  'Meal', 'Dietary', 'Song', 'Message', 'Updated', 'Children'
];

/** Browsers POST the form here. */
function doPost(e) {
  // Two guests hitting send at the same instant would otherwise race for the
  // same row.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    var p = (e && e.parameter) || {};

    // A reply with no name and no email is not a reply.
    var name  = String(p.name  || '').trim();
    var email = String(p.email || '').trim();
    if (!name && !email) return json_({ ok: false, error: 'empty' });

    var attending = String(p.attending || '').trim().toLowerCase();
    var guests    = attending === 'yes' ? Math.max(1, parseInt(p.guests, 10) || 1) : 0;
    // Someone in the party is filling in the form, so at least one adult.
    var children  = Math.min(Math.max(0, parseInt(p.children, 10) || 0), Math.max(0, guests - 1));

    var sheet = rsvpSheet_();
    var now   = new Date();

    var row = [
      now,
      name,
      email,
      attending === 'yes' ? 'yes' : 'no',
      guests,
      String(p.meal     || ''),
      String(p.dietary  || ''),
      String(p.song     || ''),
      String(p.message  || ''),
      '',
      children
    ];

    // If this email already replied, update that row rather than adding a
    // second one — otherwise someone changing their mind is counted twice.
    var existing = email ? findRowByEmail_(sheet, email) : 0;
    if (existing) {
      row[0] = sheet.getRange(existing, 1).getValue();   // keep first-reply time
      row[9] = now;                                       // note the change
      sheet.getRange(existing, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    ensureSummary_();
    if (NOTIFY_EMAIL) notify_(row, Boolean(existing));
    return json_({ ok: true, updated: Boolean(existing) });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Visiting the /exec URL in a browser confirms the deployment is live. */
function doGet() {
  return json_({ ok: true, service: 'rsvp' });
}

/* ------------------------------------------------------------------ */

function rsvpSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_RSVPS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RSVPS);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(9, 320);   // Message
  } else if (sheet.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) {
    // A Sheet made before a column was added: label the new one.
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  }
  return sheet;
}

function findRowByEmail_(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;

  var col = sheet.getRange(2, 3, last - 1, 1).getValues();   // column C, Email
  var want = email.toLowerCase();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim().toLowerCase() === want) return i + 2;
  }
  return 0;
}

/**
 * Formulas rather than computed values, so the numbers stay live if you edit
 * a row by hand — which you will, when someone texts you instead.
 */
function ensureSummary_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(SHEET_SUMMARY)) return;

  var s = ss.insertSheet(SHEET_SUMMARY, 0);
  var A = "'" + SHEET_RSVPS + "'!";

  var rows = [
    ['Headcount (people attending)', '=SUMIF(' + A + 'D2:D,"yes",' + A + 'E2:E)'],
    ['Adults',   '=SUMIF(' + A + 'D2:D,"yes",' + A + 'E2:E)-SUMIF(' + A + 'D2:D,"yes",' + A + 'K2:K)'],
    ['Children', '=SUMIF(' + A + 'D2:D,"yes",' + A + 'K2:K)'],
    ['', ''],
    ['Parties attending',           '=COUNTIF(' + A + 'D2:D,"yes")'],
    ['Parties declined',             '=COUNTIF(' + A + 'D2:D,"no")'],
    ['Replies received',             '=COUNTA(' + A + 'B2:B)'],
    ['', ''],
    ['Vegetarian',    '=COUNTIFS(' + A + 'D2:D,"yes",' + A + 'F2:F,"vegetarian")'],
    ['Seafood',       '=COUNTIFS(' + A + 'D2:D,"yes",' + A + 'F2:F,"seafood")'],
    ['No preference', '=COUNTIFS(' + A + 'D2:D,"yes",' + A + 'F2:F,"no-preference")'],
    ['', ''],
    ['With dietary notes', '=COUNTIFS(' + A + 'D2:D,"yes",' + A + 'G2:G,"<>")']
  ];

  s.getRange(1, 1, rows.length, 2).setValues(rows);
  s.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  s.getRange(1, 2).setFontSize(24);
  s.setColumnWidth(1, 240);
  s.setColumnWidth(2, 120);
}

/** Run once from the editor if you ever delete the Summary tab. */
function rebuildSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName(SHEET_SUMMARY);
  if (old) ss.deleteSheet(old);
  ensureSummary_();
}

/** A note to the organiser, with the running headcount. */
function notify_(row, wasUpdate) {
  try {
    var sheet = rsvpSheet_();
    var last  = sheet.getLastRow();
    var head  = 0;
    var kids  = 0;
    if (last >= 2) {
      var vals = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
      for (var i = 0; i < vals.length; i++) {
        if (String(vals[i][3]).toLowerCase() !== 'yes') continue;   // Attending
        head += Number(vals[i][4])  || 0;                            // Guests
        kids += Number(vals[i][10]) || 0;                            // Children
      }
    }

    var coming = row[3] === 'yes';
    var party  = row[4] + (row[4] === 1 ? ' person' : ' people');
    if (row[10]) party += ' (' + row[10] + (row[10] === 1 ? ' child' : ' children') + ')';
    var lines = [
      row[1] + ' <' + row[2] + '>',
      coming ? 'Attending — ' + party : 'Not attending',
      row[5] ? 'Meal: ' + row[5] : '',
      row[6] ? 'Dietary: ' + row[6] : '',
      row[7] ? 'Song: ' + row[7] : '',
      row[8] ? 'Message: ' + row[8] : '',
      '',
      'Headcount so far: ' + head + (kids ? ' (' + kids + (kids === 1 ? ' child' : ' children') + ')' : '')
    ].filter(String);

    MailApp.sendEmail(
      NOTIFY_EMAIL,
      (wasUpdate ? 'RSVP updated' : 'RSVP') + ' — ' + row[1] + (coming ? ' (' + row[4] + ')' : ' (declines)'),
      lines.join('\n')
    );
  } catch (err) {
    // A mail failure must never cost us the RSVP itself — but say so, or it
    // fails silently. Shows under Executions in the Apps Script editor.
    console.error('Notification email failed: ' + err);
  }
}

/**
 * Run once from the editor to check notifications work. Unlike a real RSVP it
 * lets errors through, and running it prompts for mail permission if needed.
 */
function testNotify() {
  if (!NOTIFY_EMAIL) {
    throw new Error('No NOTIFY_EMAIL Script Property — add one under Project Settings.');
  }
  console.log('Sending to: ' + NOTIFY_EMAIL);
  console.log('Emails left today: ' + MailApp.getRemainingDailyQuota());
  MailApp.sendEmail(NOTIFY_EMAIL, 'RSVP notifications are working',
    'This is a test from the wedding RSVP script.');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
