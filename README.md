# Bo-Shiang &amp; Suyi — Wedding Website

A static wedding site for **Bo-Shiang Wang & Suyi Zhu**.

> **Friday, 23 October 2026 · 6:00 PM**
> 3199 Powell St, Emeryville, CA 94608 · [Google Maps](https://maps.app.goo.gl/XZWvtAWs9UGRuyM69)

No build step, no dependencies, no framework — plain HTML, CSS and JavaScript.
Open `index.html` in a browser and it works.

---

## Before you share the link

The site is fully built, but a handful of facts weren't known when it was
written. They appear on the page in *italic dashed underline* and are wrapped
in `[ square brackets ]`. A yellow banner sits at the top of the page for as
long as any of them remain.

| # | What to fill in | Where |
|---|---|---|
| 1 | **Venue name** (the address and map link are already correct) | `index.html` → search `[ Venue name ]` |
| 2 | **Your story** — how you met, falling for each other, the proposal, and the years | `index.html` → `#story` section |
| 3 | **Dress code** | `index.html` → search `[ Cocktail attire ]` |
| 4 | **Schedule times** — only 6:00 PM is confirmed; the rest are sensible guesses | `index.html` → `#schedule` section |
| 5 | **FAQ answers** — RSVP deadline, parking, plus-ones, children, transit, contact | `index.html` → `#faq` section |
| 6 | **Photos** | see [Gallery](#gallery) below |
| 7 | **RSVP destination** | see [RSVP](#rsvp) below |

Each item has a Chinese counterpart with the same bracketed placeholder in
`assets/js/i18n.js`. Update both.

When everything is filled in:

1. Remove the `class="todo"` attributes you replaced.
2. Delete the `<div class="draft-banner">…</div>` block near the top of `index.html`
   (the banner hides itself once no `.todo` remains, but deleting it is tidier).

---

## RSVP

Open `assets/js/main.js` and set the two constants at the top:

```js
var RSVP_ENDPOINT = "";   // a form endpoint that accepts a POST
var CONTACT_EMAIL = "";   // shown to guests, and used by the email fallback
```

**With an endpoint set**, the form POSTs JSON and shows a thank-you inline.
Anything that accepts a POST works — [Formspree](https://formspree.io),
[Basin](https://usebasin.com), [Getform](https://getform.io), Netlify Forms,
or a Google Apps Script web app writing into a Sheet.

**With `RSVP_ENDPOINT` empty** (the default), submitting opens the guest's mail
client with the answers pre-filled, addressed to `CONTACT_EMAIL`. If both are
empty the form shows an error, so set at least one before you share the link.

The form validates name, email and attendance in-browser, only asks about
guest count and meals when someone is actually coming, and carries a honeypot
field that silently swallows bot submissions.

---

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
| 牡丹 peony | wealth and honour; the flower of prosperity | above **Our Story**, in red |
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

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

A plain file open (`file://`) works too.

## Publishing on GitHub Pages

Settings → Pages → Deploy from a branch → pick this branch, folder `/ (root)`.
The `.nojekyll` file is already there so Jekyll leaves the `assets/` folder alone.

---

## What's on the page

- **Hero** with the names, date, a live countdown to 6:00 PM on 23 Oct 2026,
  and 囍 / lanterns (see [The decorations](#the-decorations))
- **Our Story** — four beats on a timeline
- **The Details** — when, where, dress code, an embedded map, and an
  "Add to calendar" button serving [`assets/wedding.ics`](#the-calendar-file)
- **Schedule** for the evening
- **Gallery** with a keyboard-navigable lightbox (←/→ to move, Esc to close)
- **FAQ** as expandable questions
- **RSVP** form

### The couple's names

王柏翔 and 朱素怡 appear under the romanised names in the hero, in the footer,
in the page `<title>`, and on the social share card. They are marked
`lang="zh-Hant"` so screen readers switch voice for them.

### Bilingual

Every piece of text carries a `data-i18n` key. English lives in `index.html`,
so the page still reads correctly with JavaScript disabled; 繁體中文 lives in
`assets/js/i18n.js`. The EN / 中文 switch in the header swaps them, remembers
the choice in `localStorage`, and updates the `lang` attribute so the right
font stack applies. Guests with a Chinese browser locale land on 中文 first.

**When you edit text, edit it in both places** — the English in `index.html`
and the matching key in `assets/js/i18n.js`.

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
assets/js/i18n.js           繁體中文 translations
assets/js/main.js           behaviour + the constants you need to configure
assets/wedding.ics          the calendar file the "Add to calendar" button serves
assets/img/gallery/         placeholder photos
assets/img/favicon.svg      browser tab icon
assets/img/og-image.svg     link preview card
.nojekyll                   keeps GitHub Pages from processing assets/
```
