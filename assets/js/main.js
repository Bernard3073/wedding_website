/* ==========================================================================
   Bo-Shiang & Suyi — site behaviour
   No build step, no dependencies. Everything degrades gracefully without JS.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     CONFIGURE ME
     --------------------------------------------------------------------- */

  // Where RSVPs go. Paste the /exec URL of the Google Apps Script in
  // rsvp/Code.gs (see "Collecting and counting RSVPs" in README.md), or any
  // form endpoint that accepts a POST — Formspree, Basin, Getform.
  // Leave it empty and the form falls back to opening a pre-filled email.
  var RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbzUL8fvXvA8N_C72bRz_fXsmUX4KGnaWz_hvZag97sAW-QbMNgFNEuSUHtygO3u0n8OGQ/exec";

  // Used for the mailto fallback above, and worth filling in either way.
  var CONTACT_EMAIL = "";

  // The wedding itself, for the countdown. October is still PDT (UTC-7) in 2026.
  // If this ever changes, change assets/wedding.ics to match — the "Add to
  // calendar" button serves that file directly and is not generated from here.
  var WEDDING_ISO = "2026-10-23T18:00:00-07:00";

  // Gallery. Swap these for your own files in assets/img/gallery/.
  // `caption` is optional; `alt` should describe the photo for screen readers.
  var PHOTOS = [
    { src: "assets/img/gallery/photo-01.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-02.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-03.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-04.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-05.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-06.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-07.svg", alt: "", caption: "" },
    { src: "assets/img/gallery/photo-08.svg", alt: "", caption: "" }
  ];

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function store(key, value) {
    try {
      if (arguments.length === 1) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* private mode, blocked storage — not important enough to break on */ }
    return null;
  }

  /* ---------------------------------------------------------------------
     Language toggle
     --------------------------------------------------------------------- */
  var I18N = window.WEDDING_I18N || {};
  var LANGS = ["en", "zh-Hant", "zh-Hans"];
  var lang = "en";

  // Remember the English original of every translatable node the first time
  // we touch it, so switching back is lossless.
  $$("[data-i18n]").forEach(function (el) { el.dataset.i18nEn = el.innerHTML; });

  function t(key) {
    var dict = I18N[lang] || {};
    if (dict[key]) return dict[key];
    return (I18N.en && I18N.en[key]) || "";
  }

  function setLang(next, persist) {
    if (next === "zh") next = "zh-Hant";   // saved by the old two-way toggle
    lang = LANGS.indexOf(next) >= 0 ? next : "en";

    document.documentElement.lang = lang;

    var dict = lang === "en" ? {} : (I18N[lang] || {});
    $$("[data-i18n]").forEach(function (el) {
      var value = dict[el.dataset.i18n] || el.dataset.i18nEn;
      if (value != null) el.innerHTML = value;
    });

    $$("[data-lang-opt]").forEach(function (el) {
      var on = el.dataset.langOpt === lang;
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-pressed", String(on));
    });

    renderGallery();
    if (persist !== false) store("wedding-lang", lang);
  }

  // Simplified for the mainland, Singapore and Malaysia; Traditional for
  // Taiwan, Hong Kong, Macau, and a bare "zh".
  function browserLang() {
    var tag = navigator.language || "";
    if (!/^zh/i.test(tag)) return "en";
    return /^zh-(hans|cn|sg|my)\b/i.test(tag) ? "zh-Hans" : "zh-Hant";
  }

  var savedLang = store("wedding-lang");
  setLang(savedLang || browserLang(), Boolean(savedLang));

  var langToggle = $("#lang-toggle");
  if (langToggle) {
    langToggle.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-lang-opt]");
      if (opt) setLang(opt.dataset.langOpt);
    });
  }

  /* ---------------------------------------------------------------------
     Draft banner — only appears while [placeholders] remain
     --------------------------------------------------------------------- */
  var banner = $("#draft-banner");
  if (banner) {
    var hasPlaceholders = $$(".todo").length > 0;
    var dismissed = store("wedding-draft-dismissed") === "1";
    banner.hidden = !hasPlaceholders || dismissed;

    var dismiss = $("#draft-dismiss");
    if (dismiss) {
      dismiss.addEventListener("click", function () {
        banner.hidden = true;
        store("wedding-draft-dismissed", "1");
      });
    }
  }

  /* ---------------------------------------------------------------------
     Navigation: mobile menu, sticky shadow, active section
     --------------------------------------------------------------------- */
  var navToggle = $("#nav-toggle");
  var navMenu   = $("#nav-menu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      navMenu.classList.toggle("is-open", !open);
    });

    navMenu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        navToggle.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("is-open");
      }
    });
  }

  var header = $("#site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var sections = $$("main section[id]");
  var navLinks = $$('.nav__menu a[href^="#"]');
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------------------------------------------------------------
     Countdown
     --------------------------------------------------------------------- */
  var countdown = $("#countdown");
  if (countdown) {
    var target = new Date(WEDDING_ISO).getTime();
    var fields = {
      days:    $('[data-cd="days"]',    countdown),
      hours:   $('[data-cd="hours"]',   countdown),
      minutes: $('[data-cd="minutes"]', countdown),
      seconds: $('[data-cd="seconds"]', countdown)
    };

    var pad = function (n) { return n < 10 ? "0" + n : String(n); };

    var tick = function () {
      var diff = target - Date.now();

      if (diff <= 0) {
        countdown.classList.add("is-past");
        fields.days.textContent = fields.hours.textContent =
          fields.minutes.textContent = fields.seconds.textContent = "0";
        clearInterval(timer);
        return;
      }

      var s = Math.floor(diff / 1000);
      fields.days.textContent    = String(Math.floor(s / 86400));
      fields.hours.textContent   = pad(Math.floor(s / 3600) % 24);
      fields.minutes.textContent = pad(Math.floor(s / 60) % 60);
      fields.seconds.textContent = pad(s % 60);
    };

    tick();
    var timer = setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------------------
     Gallery + lightbox
     --------------------------------------------------------------------- */
  var grid = $("#gallery-grid");

  function renderGallery() {
    if (!grid) return;
    grid.innerHTML = "";

    PHOTOS.forEach(function (photo, i) {
      var li = document.createElement("li");
      li.className = "gallery__item";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gallery__btn";
      btn.dataset.index = String(i);

      var img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.alt || t("gallery.alt") + " " + (i + 1);
      img.loading = i < 3 ? "eager" : "lazy";
      img.decoding = "async";

      btn.appendChild(img);
      li.appendChild(btn);
      grid.appendChild(li);
    });
  }

  renderGallery();

  var lightbox = $("#lightbox");
  if (grid && lightbox) {
    var lbImg     = $("#lightbox-img");
    var lbCaption = $("#lightbox-caption");
    var current   = 0;
    var lastFocus = null;

    function show(index) {
      current = (index + PHOTOS.length) % PHOTOS.length;
      var photo = PHOTOS[current];
      lbImg.src = photo.src;
      lbImg.alt = photo.alt || t("gallery.alt") + " " + (current + 1);
      lbCaption.textContent = photo.caption || "";
    }

    function open(index) {
      lastFocus = document.activeElement;
      show(index);
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      $("#lightbox-close").focus();
    }

    function close() {
      lightbox.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".gallery__btn");
      if (btn) open(Number(btn.dataset.index));
    });

    $("#lightbox-close").addEventListener("click", close);
    $("#lightbox-prev").addEventListener("click", function () { show(current - 1); });
    $("#lightbox-next").addEventListener("click", function () { show(current + 1); });

    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });

    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape")     { close(); }
      if (e.key === "ArrowLeft")  { show(current - 1); }
      if (e.key === "ArrowRight") { show(current + 1); }
      // keep tab focus inside the dialog
      if (e.key === "Tab") {
        var focusable = $$("button", lightbox);
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------------------------------------------------------------------
     RSVP form
     --------------------------------------------------------------------- */
  var form = $("#rsvp-form");
  if (form) {
    var status      = $("#rsvp-status");
    var submitBtn   = $(".form__submit", form);
    var conditional = $("#if-attending");

    // Show the guest/meal questions only to people who are coming.
    $$('input[name="attending"]', form).forEach(function (radio) {
      radio.addEventListener("change", function () {
        conditional.hidden = radio.value !== "yes";
      });
    });

    function setError(name, show) {
      var el = $('[data-error-for="' + name + '"]', form);
      if (el) el.classList.toggle("is-shown", show);
      var input = form.elements[name.replace(/^rsvp-/, "")] || $("#" + name, form);
      if (input && input.setAttribute) input.setAttribute("aria-invalid", show ? "true" : "false");
    }

    function say(message, kind) {
      status.textContent = message;
      status.classList.toggle("is-ok",  kind === "ok");
      status.classList.toggle("is-err", kind === "err");
    }

    function validate() {
      var ok = true;

      var name = $("#rsvp-name").value.trim();
      setError("rsvp-name", !name);
      if (!name) ok = false;

      var email = $("#rsvp-email").value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      setError("rsvp-email", !emailOk);
      if (!emailOk) ok = false;

      var attending = $('input[name="attending"]:checked', form);
      setError("attending", !attending);
      if (!attending) ok = false;

      return ok;
    }

    function collect() {
      var data = {};
      new FormData(form).forEach(function (value, key) {
        if (key === "_website") return;         // honeypot, never forwarded
        data[key] = typeof value === "string" ? value.trim() : value;
      });
      if (data.attending !== "yes") {
        delete data.guests; delete data.meal; delete data.dietary; delete data.song;
      }
      return data;
    }

    function mailtoFallback(data) {
      if (!CONTACT_EMAIL) {
        say(t("rsvp.failed"), "err");
        return;
      }
      var body = Object.keys(data).map(function (k) { return k + ": " + data[k]; }).join("\n");
      window.location.href = "mailto:" + CONTACT_EMAIL +
        "?subject=" + encodeURIComponent("RSVP — " + (data.name || "")) +
        "&body=" + encodeURIComponent(body);
      say(t("rsvp.mailto"), "ok");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // A filled honeypot means a bot: pretend everything is fine, send nothing.
      if ($("#rsvp-website").value) { say(t("rsvp.thanksYes"), "ok"); return; }

      if (!validate()) { say("", null); return; }

      var data = collect();
      var thanks = data.attending === "yes" ? t("rsvp.thanksYes") : t("rsvp.thanksNo");

      if (!RSVP_ENDPOINT) { mailtoFallback(data); return; }

      submitBtn.disabled = true;
      say(t("rsvp.sending"), null);

      // Sent as FormData on purpose. multipart/form-data is a CORS-simple
      // content type, so the browser issues no preflight OPTIONS request —
      // which Google Apps Script web apps do not answer. "Accept" is a
      // safelisted header, so adding it does not trigger one either.
      // Formspree, Basin and Getform all take a form post too.
      var payload = new FormData();
      Object.keys(data).forEach(function (k) { payload.append(k, data[k]); });

      fetch(RSVP_ENDPOINT, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: payload
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          form.reset();
          conditional.hidden = true;
          say(thanks, "ok");
        })
        .catch(function () {
          say(t("rsvp.failed"), "err");
        })
        .then(function () {
          submitBtn.disabled = false;
        });
    });
  }

  /* ---------------------------------------------------------------------
     Reveal sections on scroll

     Deliberately a scroll handler rather than an IntersectionObserver:
     a fast fling can outrun the observer's async callbacks and leave a
     section stuck at opacity 0 for good. Measuring synchronously on scroll
     can't miss anything, and the sweep stops once everything is revealed.
     --------------------------------------------------------------------- */
  if (!reduceMotion) {
    var pending = $$(".section__eyebrow, .section__title, .section__lead, .card, .map, .timeline__item, .gallery__item, .faq__item, .form");
    pending.forEach(function (el) { el.classList.add("reveal"); });

    var queued = false;

    var sweep = function () {
      queued = false;
      var limit = window.innerHeight * 0.92;

      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top > limit) return true;
        el.classList.add("is-visible");
        return false;
      });

      if (!pending.length) {
        window.removeEventListener("scroll", request);
        window.removeEventListener("resize", request);
      }
    };

    var request = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(sweep);
    };

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    sweep();
  }
})();
