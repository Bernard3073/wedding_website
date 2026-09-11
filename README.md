# Bo-Shiang &amp; Suyi — Wedding Website

A static wedding site for **Bo-Shiang Wang & Suyi Zhu**.

> **Friday, 23 October 2026 · 6:00 PM**
> 3199 Powell St, Emeryville, CA 94608 · [Google Maps](https://maps.app.goo.gl/XZWvtAWs9UGRuyM69)

No build step, no dependencies, no framework — plain HTML, CSS and JavaScript.
Open `index.html` in a browser and it works — see
[Running it locally](#running-it-locally).

---

## Before you share the link

The site is fully built, but a handful of facts weren't known when it was
written. They appear on the page in *italic dashed underline* and are wrapped
in `[ square brackets ]`.

| # | What to fill in | Where |
|---|---|---|
| 1 | **Venue name** (the address and map link are already correct) | `index.html` → search `[ Venue name ]` |
| 2 | **Dress code** | `index.html` → search `[ Cocktail attire ]` |
| 3 | **Schedule times** — only 6:00 PM is confirmed; the rest are sensible guesses | `index.html` → `#schedule` section |
| 4 | **Photos** | see [Gallery](#gallery) below |
| 5 | **RSVP destination** | see [Collecting and counting RSVPs](#collecting-and-counting-rsvps) below |

Each item has Traditional and Simplified Chinese counterparts with the same
bracketed placeholder in `assets/js/i18n.js`. Update all three.

When everything is filled in, remove the `class="todo"` attributes you replaced.

---

## Collecting and counting RSVPs

Until you do this, the form has nowhere to send anything. Two options.

### Recommended: a Google Sheet you own

Free, no submission limit, and you get a spreadsheet with a live headcount.
`rsvp/Code.gs` in this repo is the whole backend.

1. Create a new Google Sheet — this is where replies will land.
2. **Extensions → Apps Script**. Delete the stub, paste in all of
   `rsvp/Code.gs`, and save.
3. *(Optional)* To get an email, with the running headcount, each time someone
   replies: **Project Settings** (gear icon) → **Script Properties** → **Add
   script property**. Name it `NOTIFY_EMAIL` and give it your address — or
   several, separated by commas. It's set there rather than in the code so the
   addresses stay out of this public repo, and changing it later needs no
   re-deploy.
4. **Deploy → New deployment → Web app**, with:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** — this one matters. "Anyone with a Google
     account" forces your guests to sign in, and most will give up.
5. Authorise it. Google will warn about an unverified app; it's your own
   script, so **Advanced → Go to (project name)** and allow it.
6. Copy the Web app URL — it ends in `/exec` — and paste it into
   `RSVP_ENDPOINT` in `assets/js/main.js`. Commit and push.
7. Send yourself a test RSVP and check it appears in the Sheet.

**If you edit the script later**, re-deploy as a *new version*
(Deploy → Manage deployments → pencil icon → Version: New version). Saving
alone does not change what the live URL runs.

### The count

The script creates two tabs. **Summary** is the one you'll live in:

| | |
|---|---|
| **Headcount (people attending)** | the number you give the caterer — it sums the guest counts, not the replies |
| Adults / Children | the headcount split, from the two numbers each guest enters |
| Parties attending / declined | how many invitations have said yes and no |
| Replies received | how many have answered at all |
| Vegetarian / seafood / no preference | meal split, for the kitchen |
| With dietary notes | how many wrote something in the allergies field |

**RSVPs** holds one row per guest — name, email, attending, guest count, meal,
dietary notes, song request, message, when they replied, and how many of the
party are children. *Guests* is the whole party, children included; the
*Children* column sits last so a Sheet that already has replies keeps its
columns in place.

**If you deployed the script before the children field existed**, paste in the
new `rsvp/Code.gs`, re-deploy it as a new version (see above), then run
`rebuildSummary` once from the editor so the Summary tab gains the Adults and
Children rows. The Children header labels itself on the next reply. Until you
re-deploy, the headcount still comes out right: the form sends the whole party
as `guests`, and the old script simply ignores the children number.

Two things worth knowing:

- **Replying twice does not double-count.** The script matches on email
  address, so someone who changes their mind updates their existing row. The
  `Updated` column records when.
- **Guests who text you instead can just be typed in.** Add a row to the RSVPs
  tab by hand; Summary is formula-driven and picks it up immediately.

To see who hasn't replied, keep your invite list in a third tab and
`VLOOKUP` against column C.

### The simpler alternative

If you'd rather not touch Apps Script, [Formspree](https://formspree.io),
[Basin](https://usebasin.com) and [Getform](https://getform.io) all give you a
URL to drop into `RSVP_ENDPOINT`. They email you each reply and show a
dashboard — but you'll be adding the guest counts up yourself, and free tiers
cap submissions (Formspree's is 50/month, which a wedding can pass).

### If you set neither

With `RSVP_ENDPOINT` empty, submitting opens the guest's mail client with the
answers pre-filled, addressed to `CONTACT_EMAIL`. It works, but it depends on
each guest actually pressing send in whatever mail app opens — fine as a
stopgap, not something to run a wedding on. If both constants are empty the
form just shows an error, so set at least one before you share the link.

### About the request

The form posts `FormData`, not JSON, on purpose: `multipart/form-data` is a
CORS-simple content type, so the browser sends no preflight `OPTIONS` request.
Apps Script web apps do not answer preflights, so a JSON post fails against
them. If you swap in a service that requires JSON, that's the line to change
in `assets/js/main.js`.

## Gallery

Placeholder tiles live in `assets/img/gallery/`. To use your own photos:

1. Drop them into `assets/img/gallery/`.
2. Edit the `PHOTOS` array in `assets/js/main.js`:

```js
var PHOTOS = [
  { src: "assets/img/gallery/engagement-01.jpg",
    alt: "Bo-Shiang and Suyi on the beach at sunset",   // for screen readers
    caption: "Half Moon Bay, 2025" },                    // optional, shown in the lightbox
  // …
];
```

Add or remove entries freely — the grid and the lightbox adapt to the array
length. Portrait crops around 4:5 look best. Resize to roughly 1600px on the
long edge so the page stays quick to load.

---

## The decorations

Traditional Taiwanese and Chinese wedding motifs, drawn as inline SVG in a
sprite at the top of `index.html` and referenced with `<use>`. They add no
network requests, scale to any size, and take their colour from CSS.

| Motif | Meaning | Where it appears |
|---|---|---|
| 囍 double happiness | the wedding character — 喜 doubled, one for each family | large watermark behind the hero, the red seal between the hero rules, faintly on the ceremony row of the schedule, and the favicon |
| 燈籠 red lanterns | celebration, warding off bad luck | hanging in the hero, swaying slowly |
| 春仔花 | the wound red silk-thread flowers a Taiwanese bride and her mother wear in their hair — distinctly Taiwanese rather than generally Chinese | above **RSVP** |
| 盤長結 endless knot | no beginning and no end | above the names in the footer, in red — Chinese knots are red silk cord |
| 祥雲 auspicious clouds | good fortune arriving | the rule under every section heading |
| 回紋 key fret | an unbroken line; continuity | the red band below the hero and along the top of the footer |
| 百年好合 | "a hundred years of harmony" — a standard wedding blessing | the footer, with an English gloss |

### Notes

- **囍 is set as a font glyph, not a path.** The character has far more grace
  than hand-drawn rectangles, and the page already loads Noto Serif TC for the
  Chinese side. `.xi` falls back through PingFang TC, Heiti TC, Songti TC and
  Microsoft JhengHei, so any machine with a CJK font renders it.
- Auspicious red (`--red`) carries the lanterns, the 囍 marks, both flowers,
  the key-fret bands and the knot. Gold is kept for the 祥雲 clouds under each
  section heading and the corner brackets, so the two colours stay in
  conversation rather than one flooding the page. To shift the balance, change
  `--red` at the top of the ornament block in `styles.css`, or swap a single
  ornament's `color`.
- The couple's names are set in ink, not red — they are names, not ornament.
- Every ornament is `aria-hidden`, outside the tab order, and `pointer-events:
  none` where it overlaps content. Screen readers skip all of it.
- The lanterns and the lower corner brackets are hidden below 34em, where they
  would crowd the names, and the hero watermark eases back.
- The lantern sway respects `prefers-reduced-motion`.

**To remove a motif**, delete its element from `index.html` — the sprite
`<symbol>` can stay, unused symbols render nothing.

## The calendar file

`assets/wedding.ics` is a real file guests download from the "Add to calendar"
button in the Details section. Apple Calendar, Google Calendar, Outlook and
most phone calendars import it directly.

It pins the event to `America/Los_Angeles` and ships the timezone rules inside
the file, so it reads as **6:00 PM Pacific** regardless of the guest's own
settings — family watching from Taiwan will see it land correctly at 9:00 AM
Saturday their time. Two reminders are built in: one the day before, one two
hours ahead.

The button is a plain link with a `download` attribute, so it works with
JavaScript disabled.

**If the date, time, or venue ever changes, edit this file too.** It is
deliberately not generated from the page, so the two can drift apart:

| Change | Also update |
|---|---|
| Date or time | `DTSTART` / `DTEND` in `assets/wedding.ics`, `WEDDING_ISO` in `assets/js/main.js`, and the hero and Details text in `index.html` |
| Venue | `LOCATION` and `DESCRIPTION` in `assets/wedding.ics` |

Bump `SEQUENCE:0` to `SEQUENCE:1` (and so on) whenever you change it after
guests have started importing — calendar apps use that number to decide
whether to accept an update to an event someone already has.

The file is written to RFC 5545: CRLF line endings, lines folded at 75 octets,
and commas escaped inside text values. If you hand-edit it, keep those intact —
an unescaped comma in `LOCATION` splits the address into several values.

## Running it locally

Nothing to install or build. Pick whichever is easiest.

### Quickest: open the file

Double-click `index.html` in Finder, or drag it onto a browser window. From
the terminal:

```bash
open index.html        # macOS
```

Everything works this way. Edit a file, save, and refresh the browser to see
the change.

### Closer to the real thing: a local server

Serving over `http://` behaves exactly like GitHub Pages will. macOS ships
with Python, so from the project folder:

```bash
cd ~/wedding_website          # wherever you cloned it
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Leave the terminal running while you work;
press `Ctrl+C` to stop it. If port 8000 is taken, use another number
(`python3 -m http.server 8080`, then `http://localhost:8080`).

In VS Code, the **Live Server** extension does the same from a right-click on
`index.html` → *Open with Live Server*, and reloads the page on every save.

### While testing

- **The language switch remembers your choice.** To see what a first-time
  visitor sees (the language picked from their browser settings), open a
  private window.
- **To check the phone layout**, open the browser's developer tools
  (`Cmd+Option+I`) and toggle the device toolbar (`Cmd+Shift+M`).
- **A test RSVP is a real RSVP.** `RSVP_ENDPOINT` points at the live Google
  Sheet whether the page runs locally or online, so a test submission lands
  in the Sheet — and emails you, if notifications are on. Delete the row
  afterwards so it does not inflate the headcount.

## Publishing on GitHub Pages

Settings → Pages → Deploy from a branch → pick this branch, folder `/ (root)`.
The `.nojekyll` file is already there so Jekyll leaves the `assets/` folder alone.

---

## What's on the page

- **Hero** with the names, date, a live countdown to 6:00 PM on 23 Oct 2026,
  and 囍 / lanterns (see [The decorations](#the-decorations))
- **The Details** — when, where, dress code, an embedded map, and an
  "Add to calendar" button serving [`assets/wedding.ics`](#the-calendar-file)
- **Schedule** for the evening
- **Gallery** with a keyboard-navigable lightbox (←/→ to move, Esc to close)
- **RSVP** form

### The couple's names

The names follow the language switch, in the hero, the footer and the browser
tab: "Bo-Shiang & Suyi" / "Bo-Shiang Wang & Suyi Zhu" in English, 柏翔 & 素怡 /
王柏翔・朱素怡 in Chinese. The keys are `names.groom`, `names.bride`,
`names.full` and `page.title` in `assets/js/i18n.js`. The static `<title>` and
the social share card stay bilingual, since link previews never run the
JavaScript.

### Bilingual

Every piece of text carries a `data-i18n` key. English lives in `index.html`,
so the page still reads correctly with JavaScript disabled; 繁體中文 and
简体中文 live in `assets/js/i18n.js`. The EN / 繁 / 简 switch in the header
swaps them, remembers the choice in `localStorage`, and sets the `lang`
attribute (`zh-Hant` or `zh-Hans`) so the right font stack applies. Guests with
a Chinese browser locale land on Chinese first: 简体 for zh-CN, zh-SG and
zh-MY, 繁體 for everything else (zh-TW, zh-HK and so on).

**When you edit text, edit it in all three places** — the English in
`index.html`, and the matching key in both dictionaries in
`assets/js/i18n.js`.

### Notes on the build

- Fonts come from Google Fonts with Georgia / system fallbacks, so the page
  still looks right if they're blocked or slow.
- Sections fade in on scroll using a synchronous scroll handler rather than an
  `IntersectionObserver` — a fast fling can outrun the observer's async
  callbacks and leave a section stuck invisible.
- `prefers-reduced-motion` disables the fades and smooth scrolling entirely.
- Verified in Chromium at 1440px, 768px and 390px: no horizontal overflow,
  no console errors.

## Layout

```
index.html                  the whole page
assets/css/styles.css       all styling; palette tokens at the top in :root
assets/js/i18n.js           繁體中文 and 简体中文 translations
assets/js/main.js           behaviour + the constants you need to configure
rsvp/Code.gs                Google Apps Script that collects RSVPs into a Sheet
assets/wedding.ics          the calendar file the "Add to calendar" button serves
assets/img/gallery/         placeholder photos
assets/img/favicon.svg      browser tab icon
assets/img/og-image.svg     link preview card
.nojekyll                   keeps GitHub Pages from processing assets/
```
