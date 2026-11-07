/* Home: the hero's darkening and the feature highlights: one pinned picture
   stage whose contents follow the block in view (after beside.com), tab pills
   that follow too, and each block's points opening one after another.
   Runs on Speed.onFrame from site.js. */
(function () {
  "use strict";
  if (!window.Speed) return;
  var S = window.Speed;
  var reduced = S.reduced;
  var clamp = S.clamp;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var hero = $(".hero");
  var night = $(".hero__night");
  var heroH = 0;
  function measure() {
    heroH = hero ? hero.offsetHeight : 0;
    reserveLists();
  }

  // Each block's list of points keeps the height of its tallest state (the
  // longest answer open), so opening another point never moves the link or
  // the picture below it on phones.
  function reserveLists() {
    $$(".facc").forEach(function (list) {
      var rows = 0;
      var tallest = 0;
      $$(".facc__item", list).forEach(function (it) {
        var a = $(".facc__a", it);
        var inner = a.firstElementChild;
        rows += it.offsetHeight - a.offsetHeight;
        tallest = Math.max(tallest, inner.scrollHeight);
      });
      var border = parseFloat(getComputedStyle(list).borderTopWidth) || 0;
      list.style.minHeight = Math.ceil(rows + tallest + border) + "px";
    });
  }

  /* ---------- Hero: night falls over the still photo as the words leave ---------- */
  S.onFrame(function (y, vh) {
    if (!night) return;
    var run = Math.max(1, heroH - vh);
    night.style.setProperty("--night", Math.pow(clamp(y / run, 0, 1), 1.6).toFixed(3));
  });

  /* ---------- Feature highlights ---------- */
  var blocks = $$(".fblock");
  var figs = $$(".fvis");
  var tabs = $$("[data-ftab]");
  var tabList = $(".ftabs ul");
  var videos = $$(".fmedia__video");
  var stageMq = window.matchMedia("(min-width: 1024px)");
  var active = -1;
  // True while the pictures share the pinned stage (desktop); false when each
  // picture sits under its own text.
  function pinned() { return stageMq.matches; }

  // Each block's points: one open at a time.
  blocks.forEach(function (block) {
    var items = $$(".facc__item", block);
    block._open = function (k) {
      items.forEach(function (it, n) {
        var on = n === k;
        var q = $(".facc__q", it);
        var a = $(".facc__a", it);
        it.classList.toggle("is-open", on);
        q.setAttribute("aria-expanded", on ? "true" : "false");
        if (on) a.hidden = false;
        else setTimeout(function () { if (!it.classList.contains("is-open")) a.hidden = true; }, 300);
      });
      // Restart the open point's progress line.
      var bar = $(".facc__item.is-open .facc__bar i", block);
      if (bar) {
        bar.style.animation = "none";
        void bar.offsetWidth;
        bar.style.animation = "";
      }
    };
    items.forEach(function (it, n) {
      $(".facc__q", it).addEventListener("click", function () {
        // A chosen point stops the automatic pass for this block.
        block.classList.remove("is-playing");
        block._stopped = true;
        block._open(n);
      });
      // When the line has filled, open the next point; stop after the last (one pass).
      $(".facc__bar i", it).addEventListener("animationend", function () {
        if (!block.classList.contains("is-playing")) return;
        if (n < items.length - 1) block._open(n + 1);
        else block.classList.remove("is-playing");
      });
    });
  });

  function setActive(i) {
    if (i === active) return;
    active = i;
    blocks.forEach(function (b, n) {
      b.classList.toggle("is-active", n === i);
      if (n !== i) b.classList.remove("is-playing");
    });
    figs.forEach(function (f, n) { f.classList.toggle("is-active", n === i); });
    var b = blocks[i];
    if (!b) return;
    if (!reduced && !b._stopped && !b._played) {
      b._played = true;
      b._open(0);
      b.classList.add("is-playing");
    }
    tabs.forEach(function (t, n) {
      if (n === i) t.setAttribute("aria-current", "location");
      else t.removeAttribute("aria-current");
    });
    // Keep the active pill in view when the pills scroll sideways.
    var t = tabs[i];
    if (tabList && t && tabList.scrollWidth > tabList.clientWidth + 2) {
      tabList.scrollTo({ left: Math.max(0, t.offsetLeft - 24), behavior: reduced ? "auto" : "smooth" });
    }
    applyStage();
  }

  // On the pinned stage only the lit picture shows and plays; the others are
  // hidden from everyone, and the next one's loop is fetched ahead so the swap
  // is instant. Under the stacked layout every picture is its own.
  function applyStage() {
    var pin = pinned();
    figs.forEach(function (f, n) {
      if (pin && n !== active) f.setAttribute("aria-hidden", "true");
      else f.removeAttribute("aria-hidden");
    });
    videos.forEach(syncVideo);
    var next = videos[active + 1];
    if (pin && mediaOn && next && !next._gone && next.preload !== "auto") {
      next.preload = "auto";
      next.load();
    }
  }
  if (stageMq.addEventListener) stageMq.addEventListener("change", applyStage);
  else if (stageMq.addListener) stageMq.addListener(applyStage);

  // The block whose top has passed the middle of the window is the lit one.
  S.onFrame(function (y, vh) {
    if (!blocks.length) return;
    var i = -1;
    for (var n = 0; n < blocks.length; n++) {
      if (blocks[n].getBoundingClientRect().top <= vh * 0.5) i = n;
    }
    // Before the first block reaches that line, light the first one.
    if (i < 0 && blocks[0].getBoundingClientRect().top < vh) i = 0;
    if (i >= 0) setActive(i);
  });

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      var b = blocks[i];
      var barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 72;
      window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - (barH + 70), behavior: reduced ? "auto" : "smooth" });
      var h = $(".fblock__h", b);
      var done = function () { h && h.focus({ preventScroll: true }); };
      if ("onscrollend" in window && !reduced) window.addEventListener("scrollend", done, { once: true });
      else setTimeout(done, 50);
      try { history.replaceState(null, "", "#" + b.id); } catch (err) { /* file:// */ }
    });
  });

  /* ---------- Product loops in the pictures ----------
     Only when motion is allowed: the poster arrives as the stage approaches,
     a loop loads and plays while its picture is on screen (and, on the pinned
     stage, is the lit one), and pauses as soon as it leaves or the tab is
     hidden. Otherwise the still stays. */
  var mediaOn = false;
  var visible = null;
  var toGif = null;
  if (videos.length && !reduced && "IntersectionObserver" in window) {
    mediaOn = true;
    document.documentElement.classList.add("media-motion");
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var v = en.target;
        if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
        near.unobserve(v);
      });
    }, { rootMargin: "800px 0px" });
    // Swap a picture to its animated GIF when its video can't play.
    toGif = function (v) {
      var box = v.closest(".fmedia");
      var img = box && box.querySelector(".fmedia__still");
      if (!img || box.classList.contains("is-gif")) return;
      img.loading = "eager";
      img.src = img.dataset.gif;
      box.classList.add("is-gif");
      v._gone = true;
      clearTimeout(v._watch);
      v.pause();
      v.removeAttribute("src");
      visible.unobserve(v);
    };
    visible = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target._inView = en.isIntersecting;
        syncVideo(en.target);
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) {
      near.observe(v);
      visible.observe(v);
      v.addEventListener("error", function () { toGif(v); }, true);
    });
    document.addEventListener("visibilitychange", function () { videos.forEach(syncVideo); });
  }

  function syncVideo(v) {
    if (!mediaOn || v._gone) return;
    var fig = v.closest(".fvis");
    var on = v._inView && !document.hidden && (!pinned() || (fig && fig.classList.contains("is-active")));
    if (on) {
      if (!v.paused) return;
      if (v.preload !== "auto") v.preload = "auto";
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () { toGif(v); });
      // Still not moving after 3 s on screen: give up on the video.
      clearTimeout(v._watch);
      v._watch = setTimeout(function () {
        if (v.paused || v.readyState < 2) toGif(v);
      }, 3000);
    } else {
      clearTimeout(v._watch);
      if (!v.paused) v.pause();
    }
  }

  /* ---------- speed. AI: the dimming and the demo ----------
     Night falls over the pinned backdrop as the section arrives, on the
     hero's curve; past halfway the section counts as dark for the top bar. The
     demo runs on one clock: each scene types its question, sends it, checks,
     then answers, and fades into the next. It plays only while on screen.
     Reduced motion: the first scene, finished, and nothing moves. */
  (function () {
  var aiSec = $("#ai");
  var aiw = $("#aiw");
  if (aiSec && aiw) {
    S.onFrame(function (y, vh) {
      var r = aiSec.getBoundingClientRect();
      // The hero's curve, once the backdrop is pinned: night falls slowly,
      // then faster, and is complete as the headline nears the top third.
      var m = Math.pow(clamp(-r.top / (vh * 0.55), 0, 1), 1.6);
      aiSec.style.setProperty("--mesh", m.toFixed(3));
      var tone = m > 0.5 ? "dark" : "light";
      if (aiSec.getAttribute("data-tone") !== tone) aiSec.setAttribute("data-tone", tone);
    });

    var thread = $(".aiw__thread", aiw);
    var typed = $(".aiw__typed", aiw);
    var composer = $(".aiw__composer", aiw);
    var sendBtn = $(".aiw__send", aiw);
    var cursor = $(".aiw__cursor", aiw);
    var icon = function (n) { return '<svg class="icon" aria-hidden="true"><use href="#' + n + '"/></svg>'; };
    var dot = '<span class="m-card__avatar"></span>';

    var SCENES = [
      {
        q: "Who owes us the most?",
        checking: "Checking invoices and payments…",
        sources: [["i-receipt", "Invoices · unpaid"], ["i-credit-card", "Payments · last 60 days"], ["i-users", "Customers · 3"]],
        answer: '<div class="m-card">' + '<p class="m-card__head">' + dot + "<span>3 customers owe you ₦1,184,000. Bisi &amp; Sons owes the most.</span></p>" +
          '<div class="m-rows">' +
          '<div class="m-row"><span class="m-ini">BS</span><span><span class="m-row__name">Bisi &amp; Sons</span><span class="m-row__detail">2 invoices · 21 days late</span></span><span class="m-row__amt">₦480,000</span></div>' +
          '<div class="m-row"><span class="m-ini">KV</span><span><span class="m-row__name">Kunle Ventures</span><span class="m-row__detail">1 invoice · 9 days late</span></span><span class="m-row__amt">₦412,500</span></div>' +
          '<div class="m-row"><span class="m-ini">AE</span><span><span class="m-row__name">Amaka Eze</span><span class="m-row__detail">3 invoices · 4 days late</span></span><span class="m-row__amt">₦291,500</span></div>' +
          "</div></div>",
        sugg: '<div class="m-sugg"><p class="m-label">Suggested</p><p class="m-sugg__line">Send Bisi &amp; Sons a friendly reminder for ₦480,000, with both invoices attached?</p>' +
          '<div class="m-btns"><span class="m-btn m-btn--yes">Approve</span><span class="m-btn">Not now</span></div></div>',
        act: null,
        dur: 11000
      },
      {
        q: "What isn’t selling?",
        checking: "Checking sales and stock…",
        sources: [["i-chart-line", "Sales · last 30 days"], ["i-package", "Stock · all branches"]],
        answer: '<div class="m-card"><p class="m-card__head">' + dot + "<span>52 cartons of malt drink haven’t moved in 30 days. Everything else sold at least once a week.</span></p></div>",
        sugg: '<div class="m-sugg"><p class="m-label">Suggested</p><p class="m-sugg__line">Run 10% off the malt drink for a week? You still keep 18% on every carton after the discount.</p>' +
          '<div class="m-btns"><span class="m-btn m-btn--yes">Approve</span><span class="m-btn">Not now</span></div></div>',
        act: { target: ".m-btn--yes", done: '<span class="m-done">' + icon("i-check-check") + "Approved by you. The offer starts today.</span>", label: "Approved" },
        dur: 12500
      },
      {
        q: "Draft replies to tonight’s DMs",
        checking: "Reading 40 waiting DMs…",
        sources: [["g-instagram", "Instagram · 28"], ["g-whatsapp", "WhatsApp · 12"]],
        answer: '<div class="m-card"><p class="m-card__head">' + dot + "<span>Here’s the first of 40, in your voice.</span></p>" +
          '<div class="m-draft"><div class="m-dm"><span class="m-ini">IO<svg class="m-ini__badge" aria-hidden="true"><use href="#g-instagram"/></svg></span><div><span class="m-row__name">Ifeoma O.</span><p class="m-dm__msg">Do you still have the Asokoro chair in green?</p></div></div></div></div>',
        sugg: '<div class="m-sugg"><p class="m-label">' + icon("i-sparkles") + "Drafted by <span class=\"wm-text\">speed.</span> AI</p>" +
          '<p class="m-sugg__line">Hi Ifeoma 👋 yes, the Asokoro accent chair comes in dark green. ₦245,000 each. Shall I keep one for you?</p>' +
          '<div class="m-btns"><span class="m-btn m-btn--yes">Send</span><span class="m-btn">Edit</span></div></div>',
        act: { target: ".m-btn--yes", done: '<span class="m-done">' + icon("i-check-check") + "Sent to Ifeoma on Instagram.</span>", label: "Sent" },
        dur: 12500
      }
    ];

    var scene = 0;
    var t = 0;
    var plan = [];
    var done = 0;
    var playing = false;
    var inView = false;
    var last = 0;

    var setText = function (s) {
      typed.textContent = s;
      aiw.classList.toggle("has-text", s.length > 0);
    };
    // The composer slides from the middle of the window to its foot.
    var setThread = function (on, animate) {
      var before = composer.getBoundingClientRect().top;
      aiw.setAttribute("data-state", on ? "thread" : "empty");
      if (!animate || !composer.animate) return;
      var dy = before - composer.getBoundingClientRect().top;
      if (dy) composer.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "none" }], { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    };
    var add = function (html, cls) {
      var d = document.createElement("div");
      d.className = cls || "";
      d.innerHTML = html;
      var el = d.childElementCount === 1 && !cls ? d.firstElementChild : d;
      el.classList.add("m-in");
      thread.appendChild(el);
      return el;
    };
    var statusHTML = function (sc, finished) {
      if (!finished) return '<span class="m-loader"></span>' + sc.checking;
      return '<span class="m-loader"></span>Looked at' + sc.sources.map(function (s) { return '<span class="m-chip">' + icon(s[0]) + s[1] + "</span>"; }).join("");
    };
    var moveCursor = function (el, click) {
      if (!el) return;
      var b = aiw.querySelector(".aiw__body").getBoundingClientRect();
      var r = el.getBoundingClientRect();
      cursor.classList.add("is-on");
      cursor.style.transform = "translate(" + Math.round(r.left - b.left + r.width * 0.45) + "px," + Math.round(r.top - b.top + r.height * 0.4) + "px)";
      if (click) {
        cursor.classList.remove("is-click");
        void cursor.getBoundingClientRect();
        cursor.classList.add("is-click");
        el.classList.add("is-pressed");
      }
    };
    var act = function (sc) {
      var s = $(".m-sugg:last-child", thread);
      if (!s) return;
      s.classList.add("is-approved");
      var lab = $(".m-label", s);
      if (lab && sc.act.label) lab.textContent = sc.act.label;
      $(".m-btns", s).innerHTML = sc.act.done;
    };

    // One scene as a list of timed steps; typing runs as a step with a length.
    var build = function (sc) {
      var steps = [];
      var at = 450;
      var typeEnd = at + sc.q.length * 45;
      steps.push({ at: at, type: sc.q, end: typeEnd });
      at = typeEnd + 350;
      steps.push({ at: at - 120, fn: function () { sendBtn.classList.add("is-pressed"); } });
      steps.push({ at: at, fn: function () {
        sendBtn.classList.remove("is-pressed");
        setText("");
        add('<div class="m-user">' + sc.q + '<span class="m-user__meta">now' + icon("i-check-check") + "</span></div>");
        setThread(true, !reduced);
      } });
      var status;
      steps.push({ at: at + 600, fn: function () { status = add(statusHTML(sc, false), "m-status"); } });
      steps.push({ at: at + 2000, fn: function () { status.classList.add("is-done"); status.innerHTML = statusHTML(sc, true); } });
      steps.push({ at: at + 2700, fn: function () { add(sc.answer); } });
      steps.push({ at: at + 3900, fn: function () { add(sc.sugg); } });
      if (sc.act) {
        steps.push({ at: at + 5000, fn: function () { cursor.classList.add("is-on"); moveCursor($(".m-sugg:last-child " + sc.act.target, thread)); } });
        steps.push({ at: at + 6100, fn: function () { moveCursor($(".m-sugg:last-child " + sc.act.target, thread), true); } });
        steps.push({ at: at + 6400, fn: function () { act(sc); } });
        steps.push({ at: at + 7300, fn: function () { cursor.classList.remove("is-on"); } });
      }
      return steps;
    };
    var reset = function () {
      thread.innerHTML = "";
      setText("");
      cursor.classList.remove("is-on", "is-click");
      setThread(false, false);
    };
    var start = function (i) {
      scene = i;
      t = 0;
      done = 0;
      plan = build(SCENES[i]);
      reset();
      thread.classList.remove("is-fading");
    };
    // The finished state of a scene, for reduced motion.
    var finish = function (i) {
      start(i);
      plan.forEach(function (s) { if (s.fn) s.fn(); });
      $$(".m-in", thread).forEach(function (el) { el.classList.remove("m-in"); });
      cursor.classList.remove("is-on", "is-click");
    };
    var tick = function (now) {
      if (!playing) return;
      var dt = Math.min(64, now - (last || now));
      last = now;
      t += dt;
      var sc = SCENES[scene];
      while (done < plan.length && plan[done].at <= t) {
        var s = plan[done];
        if (s.type) {
          if (t < s.end) break;
          setText(s.type);
        } else s.fn();
        done++;
      }
      var cur = plan[done];
      if (cur && cur.type && t >= cur.at) setText(cur.type.slice(0, Math.floor((t - cur.at) / 45)));
      if (t >= sc.dur - 400) thread.classList.add("is-fading");
      if (t >= sc.dur) start((scene + 1) % SCENES.length);
      requestAnimationFrame(tick);
    };
    var setPlaying = function () {
      var on = !reduced && inView && !document.hidden;
      if (on === playing) return;
      playing = on;
      last = 0;
      if (on) requestAnimationFrame(tick);
    };

    if (reduced) finish(0);
    else {
      start(0);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (en) {
          inView = en[0].isIntersecting;
          setPlaying();
        }, { threshold: 0.35 }).observe(aiw);
      } else {
        inView = true;
        setPlaying();
      }
      document.addEventListener("visibilitychange", setPlaying);
    }
  }
  })();

  measure();
  S.onResize(measure);
  window.addEventListener("load", function () {
    measure();
    S.refresh();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
