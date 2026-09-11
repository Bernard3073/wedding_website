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

// Guests is the whole party, children included. Columns are found by these
// header names rather than by position (see columns_), so the order here only
// decides the layout of a brand-new Sheet.
var HEADERS = [
  'Timestamp', 'Name', 'Email', 'Attending', 'Guests', 'Children',
  'Message', 'Updated'
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
    var cols  = columns_(sheet);
    var width = sheet.getLastColumn();
    var now   = new Date();

    var reply = {
      Timestamp: now,
      Name:      name,
      Email:     email,
      Attending: attending === 'yes' ? 'yes' : 'no',
      Guests:    guests,
      Children:  children,
      Message:   String(p.message || ''),
      Updated:   ''
    };

    // If this email already replied, update that row rather than adding a
    // second one — otherwise someone changing their mind is counted twice.
    // Starting from the existing row leaves any column this script does not
    // know about as it was.
    var existing = email ? findRowByEmail_(sheet, cols, email) : 0;
    var row;
    if (existing) {
      row = sheet.getRange(existing, 1, 1, width).getValues()[0];
      reply.Timestamp = row[cols.Timestamp];   // keep first-reply time
      reply.Updated   = now;                   // note the change
    } else {
      row = [];
      for (var i = 0; i < width; i++) row.push('');
    }
    HEADERS.forEach(function (h) { row[cols[h]] = reply[h]; });

    if (existing) sheet.getRange(existing, 1, 1, width).setValues([row]);
    else          sheet.appendRow(row);

    ensureSummary_(cols);
    if (NOTIFY_EMAIL) notify_(sheet, cols, reply, Boolean(existing));
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
  var sheet = ss.getSheetByName(SHEET_RSVPS) || ss.insertSheet(SHEET_RSVPS);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(HEADERS.indexOf('Message') + 1, 320);
  }
  return sheet;
}

/**
 * Where each field lives, as 0-based column indexes, found by header name.
 * A Sheet made by an earlier version of this script keeps working: a column
 * it lacks is added at the end, and a column no longer asked for (Meal,
 * Dietary, Song) is left alone with what it holds — delete it whenever.
 * Moving or inserting columns by hand is fine too.
 */
function columns_(sheet) {
  var width = sheet.getLastColumn();
  var head  = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h).trim();
  });

  var cols = {};
  HEADERS.forEach(function (h) {
    var i = head.indexOf(h);
    if (i < 0) {
      i = head.length;
      head.push(h);
      sheet.getRange(1, i + 1).setValue(h).setFontWeight('bold');
    }
    cols[h] = i;
  });
  return cols;
}

function findRowByEmail_(sheet, cols, email) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;

  var col = sheet.getRange(2, cols.Email + 1, last - 1, 1).getValues();
  var want = email.toLowerCase();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim().toLowerCase() === want) return i + 2;
  }
  return 0;
}

/** 0 → A, 25 → Z, 26 → AA. */
function letter_(index) {
  var s = '';
  for (var n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + (n - 1) % 26) + s;
  }
  return s;
}

/**
 * Formulas rather than computed values, so the numbers stay live if you edit
 * a row by hand — which you will, when someone texts you instead. Sheets
 * rewrites the references itself if you later move or delete columns.
 */
function ensureSummary_(cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(SHEET_SUMMARY)) return;

  var s = ss.insertSheet(SHEET_SUMMARY, 0);
  var range = function (h) {
    var c = letter_(cols[h]);
    return "'" + SHEET_RSVPS + "'!" + c + '2:' + c;
  };
  var att = range('Attending'), guests = range('Guests'), kids = range('Children');

  var rows = [
    ['Headcount (people attending)', '=SUMIF(' + att + ',"yes",' + guests + ')'],
    ['Adults',   '=SUMIF(' + att + ',"yes",' + guests + ')-SUMIF(' + att + ',"yes",' + kids + ')'],
    ['Children', '=SUMIF(' + att + ',"yes",' + kids + ')'],
    ['', ''],
    ['Parties attending', '=COUNTIF(' + att + ',"yes")'],
    ['Parties declined',  '=COUNTIF(' + att + ',"no")'],
    ['Replies received',  '=COUNTA(' + range('Name') + ')']
  ];

  s.getRange(1, 1, rows.length, 2).setValues(rows);
  s.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  s.getRange(1, 2).setFontSize(24);
  s.setColumnWidth(1, 240);
  s.setColumnWidth(2, 120);
}

/**
 * Run once from the editor if you ever delete the Summary tab, or after
 * updating this script, to pick up changes to the totals it shows.
 */
function rebuildSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName(SHEET_SUMMARY);
  if (old) ss.deleteSheet(old);
  ensureSummary_(columns_(rsvpSheet_()));
}

/** A note to the organiser, with the running headcount. */
function notify_(sheet, cols, reply, wasUpdate) {
  try {
    var last = sheet.getLastRow();
    var head = 0;
    var kids = 0;
    if (last >= 2) {
      var vals = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
      for (var i = 0; i < vals.length; i++) {
        if (String(vals[i][cols.Attending]).toLowerCase() !== 'yes') continue;
        head += Number(vals[i][cols.Guests])   || 0;
        kids += Number(vals[i][cols.Children]) || 0;
      }
    }

    var coming = reply.Attending === 'yes';
    var party  = reply.Guests + (reply.Guests === 1 ? ' person' : ' people');
    if (reply.Children) party += ' (' + reply.Children + (reply.Children === 1 ? ' child' : ' children') + ')';
    var lines = [
      reply.Name + ' <' + reply.Email + '>',
      coming ? 'Attending — ' + party : 'Not attending',
      reply.Message ? 'Message: ' + reply.Message : '',
      '',
      'Headcount so far: ' + head + (kids ? ' (' + kids + (kids === 1 ? ' child' : ' children') + ')' : '')
    ].filter(String);

    MailApp.sendEmail(
      NOTIFY_EMAIL,
      (wasUpdate ? 'RSVP updated' : 'RSVP') + ' — ' + reply.Name + (coming ? ' (' + reply.Guests + ')' : ' (declines)'),
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
