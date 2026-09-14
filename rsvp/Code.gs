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
 *
 * Everyone who replies yes is emailed a confirmation with the wedding attached
 * as a calendar file (see "Calendar invite" below).
 */

// Optional: get an email the moment someone replies. Set a Script Property
// named NOTIFY_EMAIL (Project Settings → Script Properties), with several
// addresses separated by commas. It lives there rather than here so the
// addresses stay out of the public repo. Leave it unset for no email.
var NOTIFY_EMAIL =
  PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || '';

var SHEET_RSVPS   = 'RSVPs';
var SHEET_SUMMARY = 'Summary';

// Guests is the whole party: Adults plus Children. Columns are found by these
// header names rather than by position (see columns_), so the order here only
// decides the layout of a brand-new Sheet. Invite sent is when the guest's
// calendar invite was emailed.
var HEADERS = [
  'Timestamp', 'Name', 'Email', 'Attending', 'Guests', 'Adults', 'Children',
  'Message', 'Updated', 'Invite sent'
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
      Adults:    guests - children,   // derived, so the three always add up
      Children:  children,
      Message:   String(p.message || ''),
      Updated:   '',
      'Invite sent': ''
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
      reply['Invite sent'] = row[cols['Invite sent']];
    } else {
      row = [];
      for (var i = 0; i < width; i++) row.push('');
    }
    HEADERS.forEach(function (h) { row[cols[h]] = reply[h]; });

    if (existing) sheet.getRange(existing, 1, 1, width).setValues([row]);
    else          sheet.appendRow(row);

    ensureSummary_(cols);
    // Every yes gets the invite, updates included: it doubles as confirmation
    // of what they just sent, and calendars match the event by its UID, so a
    // second copy updates the first rather than adding another.
    if (reply.Attending === 'yes' && email) {
      sendInvite_(sheet, cols, existing || sheet.getLastRow(), reply);
    }
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
 * it lacks (Adults, say) is added at the end, and a column no longer asked
 * for (Meal, Dietary, Song) is left alone with what it holds — delete it
 * whenever.
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

  // Adults is Guests minus Children rather than a sum of the Adults column, so
  // replies from before that column existed are still counted.
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
    if (reply.Children) {
      party += ' (' + reply.Adults + (reply.Adults === 1 ? ' adult, ' : ' adults, ') +
               reply.Children + (reply.Children === 1 ? ' child' : ' children') + ')';
    }
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

/* ------------------------------------------------------------------ */
/* Calendar invite                                                     */
/* ------------------------------------------------------------------ */

// A copy of assets/wedding.ics, line for line — same UID, so a guest who also
// uses the "Add to calendar" button ends up with one event, not two. The
// script cannot read the site's file, so if you change one, change both.
var ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Bo-Shiang and Suyi//Wedding 2026//EN',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'BEGIN:VTIMEZONE',
  'TZID:America/Los_Angeles',
  'X-LIC-LOCATION:America/Los_Angeles',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:wedding-2026-10-23-boshiang-suyi@wedding.invalid',
  'DTSTAMP:20260913T000000Z',
  'SEQUENCE:1',
  'DTSTART;TZID=America/Los_Angeles:20261023T180000',
  'DTEND;TZID=America/Los_Angeles:20261023T230000',
  'SUMMARY:Bo-Shiang & Suyi\'s Wedding',
  'LOCATION:Hong Kong East Ocean Seafood Restaurant\\, 3199 Powell St\\,',
  '  Emeryville\\, CA 94608',
  'DESCRIPTION:We can\'t wait to celebrate with you.\\n\\nCeremony begins at 6:00',
  '  PM.\\n\\nHong Kong East Ocean Seafood Restaurant\\n3199 Powell St\\,',
  '  Emeryville\\, CA 94608\\nhttps://maps.app.goo.gl/XZWvtAWs9UGRuyM69',
  'URL:https://maps.app.goo.gl/XZWvtAWs9UGRuyM69',
  'STATUS:CONFIRMED',
  'TRANSP:OPAQUE',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Bo-Shiang & Suyi\'s wedding is tomorrow',
  'TRIGGER:-P1D',
  'END:VALARM',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Bo-Shiang & Suyi\'s wedding starts in 2 hours',
  'TRIGGER:-PT2H',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR'
];

var MAP_URL = 'https://maps.app.goo.gl/XZWvtAWs9UGRuyM69';

/**
 * Subject and body of the invite. The guest's name and message are left out
 * on purpose: anyone can post to this web app with any address, and echoing
 * their text would let a stranger send words of their choosing from your
 * Gmail.
 */
function inviteEmail_(adults, kids) {
  var n = adults + kids;
  var party = n + (n === 1 ? ' guest' : ' guests') + (kids
    ? ' (' + adults + (adults === 1 ? ' adult, ' : ' adults, ') +
      kids + (kids === 1 ? ' child)' : ' children)')
    : '');

  return {
    subject: 'See you on October 23 — Bo-Shiang & Suyi\'s wedding',
    body: [
      'Thank you for your RSVP — we can\'t wait to celebrate with you.',
      '',
      'We have you down for ' + party + '.',
      '',
      'When: Friday, October 23, 2026, 6:00 PM Pacific Time. Doors open at 5:30 PM.',
      'Where: Hong Kong East Ocean Seafood Restaurant',
      '3199 Powell St, Emeryville, CA 94608',
      MAP_URL,
      '',
      'The attached calendar file adds the evening to your calendar — open it on your phone or computer.',
      '',
      'If your plans change, fill in the RSVP form again with this email address and we\'ll update your reply.',
      '',
      'Bo-Shiang & Suyi'
    ].join('\n')
  };
}

/**
 * Emails one guest the invite and stamps Invite sent on their row. Returns
 * whether it went. Like notify_, a failure is logged, never thrown — it must
 * not cost the guest their RSVP.
 */
function sendInvite_(sheet, cols, rowIndex, guest) {
  try {
    var mail = inviteEmail_(guest.Adults, guest.Children);
    MailApp.sendEmail({
      to:      guest.Email,
      subject: mail.subject,
      body:    mail.body,
      name:    'Bo-Shiang & Suyi',
      attachments: [Utilities.newBlob(ICS.join('\r\n') + '\r\n', 'text/calendar',
                                      'bo-shiang-and-suyi-wedding.ics')]
    });
    sheet.getRange(rowIndex, cols['Invite sent'] + 1).setValue(new Date());
    return true;
  } catch (err) {
    console.error('Calendar invite to ' + guest.Email + ' failed: ' + err);
    return false;
  }
}

/**
 * Run from the editor to invite everyone attending whose Invite sent is blank —
 * guests who replied before this feature existed, or whose email failed. Safe
 * to run again: anyone already invited is skipped. It stops when the daily
 * email quota runs out; run it again the next day to finish.
 */
function sendCalendarInvites() {
  var sheet = rsvpSheet_();
  var cols  = columns_(sheet);
  var last  = sheet.getLastRow();
  if (last < 2) { console.log('No replies yet.'); return; }

  var vals = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var sent = 0, failed = 0, waiting = 0;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var email = String(r[cols.Email]).trim();
    if (String(r[cols.Attending]).trim().toLowerCase() !== 'yes') continue;
    if (!email || r[cols['Invite sent']]) continue;
    if (MailApp.getRemainingDailyQuota() < 1) { waiting++; continue; }

    // Guests and Children, as in the Summary, so hand-typed rows work too.
    var guests = Math.max(1, Number(r[cols.Guests]) || 1);
    var kids   = Math.min(Math.max(0, Number(r[cols.Children]) || 0), guests - 1);
    var ok = sendInvite_(sheet, cols, i + 2, {
      Email: email, Adults: guests - kids, Children: kids
    });
    if (ok) sent++; else failed++;
  }

  console.log('Invites sent: ' + sent);
  if (failed)  console.log('Failed (see errors above): ' + failed);
  if (waiting) console.log('Out of email quota — run again tomorrow for the last ' + waiting);
}

/**
 * Run from the editor after changing the event (bump SEQUENCE in ICS and in
 * assets/wedding.ics first): re-sends the invite to everyone attending, so
 * calendars that already have the event update it.
 */
function resendCalendarInvites() {
  var sheet = rsvpSheet_();
  var cols  = columns_(sheet);
  var last  = sheet.getLastRow();
  if (last >= 2) sheet.getRange(2, cols['Invite sent'] + 1, last - 1, 1).clearContent();
  sendCalendarInvites();
}

/**
 * Run once from the editor to see the invite as a guest will: sends a sample
 * to NOTIFY_EMAIL, without touching the Sheet.
 */
function testInvite() {
  if (!NOTIFY_EMAIL) {
    throw new Error('No NOTIFY_EMAIL Script Property — add one under Project Settings.');
  }
  var mail = inviteEmail_(2, 1);
  MailApp.sendEmail({
    to: NOTIFY_EMAIL, subject: '[Test] ' + mail.subject, body: mail.body,
    name: 'Bo-Shiang & Suyi',
    attachments: [Utilities.newBlob(ICS.join('\r\n') + '\r\n', 'text/calendar',
                                    'bo-shiang-and-suyi-wedding.ics')]
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
