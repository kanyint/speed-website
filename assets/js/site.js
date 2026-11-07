/* speed. site script, shared by every page: entrances, the top bar and its
   menus, the phone menu, the questions, the example month's flow and
   the footer. Page scripts (home.js) plug into Speed.onFrame and Speed.toneAt.
   Content never depends on this file: without it every section is visible. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = root.classList.contains("js-reduced");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- Frame loop: one rAF per scroll/resize, shared by everyone ---------- */
  var frameFns = [];
  var resizeFns = [];
  var queued = false;
  function frame() {
    queued = false;
    var y = window.scrollY;
    var vh = window.innerHeight;
    for (var i = 0; i < frameFns.length; i++) frameFns[i](y, vh);
  }
  function queue() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", function () {
    resizeFns.forEach(function (fn) { fn(); });
    queue();
  });

  /* ---------- Tones: which surface sits under a given screen y ---------- */
  var toneSections = $$("main section[data-tone], .footer[data-tone]").filter(function (el) {
    return !el.closest(".chapter") || el.classList.contains("chapter");
  });
  var toneResolver = null;
  function toneAt(y) {
    if (toneResolver) {
      var t = toneResolver(y);
      if (t) return t;
    }
    var found = "light";
    for (var i = 0; i < toneSections.length; i++) {
      var r = toneSections[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) found = toneSections[i].getAttribute("data-tone");
    }
    return found;
  }

  /* ---------- Analytics: one event per destination (sent only after consent) ---------- */
  window.speedEvents = window.speedEvents || [];
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-event]");
    if (!a) return;
    window.speedEvents.push({
      event: a.getAttribute("data-event"),
      page: location.pathname,
      section: a.getAttribute("data-section") || "",
      variant: "A",
      text: a.textContent.trim()
    });
  });

  /* ---------- Entrances ---------- */
  var groups = $$("[data-reveal-group]");
  groups.forEach(function (g) {
    $$("[data-reveal]", g).forEach(function (el, i) {
      if (!el.style.getPropertyValue("--delay") && el.getAttribute("data-reveal") !== "pic") {
        el.style.setProperty("--delay", Math.min(i, 8) * 80 + "ms");
      }
    });
  });
  function reveal(el) {
    el.classList.add("is-in");
    el.dispatchEvent(new CustomEvent("speed:in", { bubbles: true }));
  }
  if ("IntersectionObserver" in window) {
    var makeIO = function (margin) {
      return new IntersectionObserver(
        function (entries, io) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              reveal(en.target);
              io.unobserve(en.target);
            }
          });
        },
        { rootMargin: "0px 0px " + margin + " 0px", threshold: 0 }
      );
    };
    var ioSection = makeIO("-15%");
    var ioChapter = makeIO("-35%");
    groups.forEach(function (g) {
      (g.getAttribute("data-reveal-group") === "chapter" ? ioChapter : ioSection).observe(g);
    });
    $$(".footer, .blueprint").forEach(function (el) { ioSection.observe(el); });
  } else {
    groups.forEach(reveal);
  }

  /* ---------- Hero entrance (after the opening, when there is one) ---------- */
  var hero = $(".hero");
  var topbar = $("#topbar");
  var enterHero = function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (hero) hero.classList.add("is-ready");
        setTimeout(function () { topbar && topbar.classList.remove("is-loading"); }, reduced ? 0 : 200);
      });
    });
  };
  var intro = $("#intro");
  if (intro && root.classList.contains("intro-playing")) {
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      try { sessionStorage.setItem("speed.intro", "1"); } catch (e) {}
      intro.classList.add("is-done");
      root.classList.remove("intro-playing");
      enterHero();
      setTimeout(function () { intro.remove(); }, 400);
    };
    // Words (about 1.5 s), then the midnight panel (0.8 s), then the hero.
    setTimeout(finish, 3250);
    // Any click, tap or key skips straight to the page.
    intro.addEventListener("click", finish);
    window.addEventListener("keydown", finish, { once: true });
  } else {
    if (intro) intro.remove();
    enterHero();
  }

  /* ---------- Top bar ----------
     Fixed and full width (after harvey.ai). Its tint appears once the page
     has scrolled under it, its tone follows the section under the row (dark
     while the phone menu is open), and its height is published as
     --topbar-h for everything that sits below it (the feature tabs, the
     picture stage, scroll targets, the phone menu). */
  var barTone = "";
  var barH = 0;
  frameFns.push(function (y) {
    if (!topbar) return;
    topbar.classList.toggle("is-scrolled", y > 8);
    var h = topbar.offsetHeight;
    if (h !== barH) {
      barH = h;
      root.style.setProperty("--topbar-h", h + "px");
    }
    var t = root.classList.contains("menu-open") ? "dark" : toneAt(h / 2);
    if (t !== barTone) {
      barTone = t;
      topbar.setAttribute("data-tone", t);
    }
    // A menu opened by hover closes as soon as the page scrolls on.
    if (openName && Math.abs(y - menuY) > 24) closeMenu();
  });

  /* ---------- Product, Use cases and Company menus ----------
     Harvey's behaviour in our shapes: one soft pill glides between the links
     under the pointer, the other links step back while a menu is open, and
     one card holds every menu, resizing as you move from one to the next. */
  var nav = $(".topbar__nav");
  var shell = $("#menu-shell");
  var glow = $(".nav-glow");
  var triggers = $$("[data-menu]");
  var openName = null;
  var hoverTimer = 0;
  var leaveTimer = 0;
  var hoverOpenedAt = 0;
  var menuY = 0;
  function panelFor(name) { return $('[data-panel="' + name + '"]'); }
  function triggerFor(name) { return $('[data-menu="' + name + '"]'); }

  function moveGlow(el) {
    if (!glow || !finePointer) return;
    if (!el) {
      glow.classList.remove("is-on");
      return;
    }
    // From nothing, the pill appears where it is needed instead of sliding in.
    var jump = !glow.classList.contains("is-on");
    if (jump) glow.classList.add("is-jump");
    glow.style.setProperty("--glow-x", el.offsetLeft + "px");
    glow.style.setProperty("--glow-w", el.offsetWidth + "px");
    if (jump) {
      void glow.offsetWidth;
      glow.classList.remove("is-jump");
    }
    glow.classList.add("is-on");
  }
  if (nav && glow && finePointer) {
    nav.classList.add("has-glow");
    $$(".nav-item", nav).forEach(function (item) {
      item.addEventListener("mouseenter", function () { moveGlow(item); });
      item.addEventListener("focus", function () { if (item.matches(":focus-visible")) moveGlow(item); });
    });
    nav.addEventListener("mouseleave", function () { moveGlow(openName ? triggerFor(openName) : null); });
    nav.addEventListener("focusout", function (e) {
      if (!nav.contains(e.relatedTarget)) moveGlow(openName ? triggerFor(openName) : null);
    });
  }

  function sizeShell(panel, instant) {
    if (!shell || !panel) return;
    shell.classList.toggle("is-fresh", !!instant);
    shell.style.setProperty("--shell-h", panel.offsetHeight + "px");
    if (instant) {
      void shell.offsetWidth;
      shell.classList.remove("is-fresh");
    }
  }
  function setMenu(name, focusFirst) {
    if (openName === name) return;
    menuY = window.scrollY;
    var panel = name ? panelFor(name) : null;
    triggers.forEach(function (t) {
      t.setAttribute("aria-expanded", t.getAttribute("data-menu") === name ? "true" : "false");
    });
    $$("[data-panel]").forEach(function (p) {
      p.classList.toggle("is-open", p === panel);
    });
    if (nav) nav.classList.toggle("has-open", !!panel);
    if (shell) {
      if (panel) sizeShell(panel, !openName);
      shell.classList.toggle("is-open", !!panel);
    }
    openName = name;
    if (panel) moveGlow(triggerFor(name));
    else if (nav && !nav.matches(":hover")) moveGlow(null);
    if (panel && focusFirst) {
      var first = $("a", panel);
      first && first.focus();
    }
  }
  function closeMenu(returnFocus) {
    var was = openName;
    setMenu(null);
    if (returnFocus && was) {
      var t = triggerFor(was);
      t && t.focus();
    }
  }
  resizeFns.push(function () { if (openName) sizeShell(panelFor(openName), true); });

  triggers.forEach(function (t) {
    var name = t.getAttribute("data-menu");
    t.addEventListener("click", function () {
      // A click straight after the hover opened it means "open", not "toggle shut".
      if (openName === name && Date.now() - hoverOpenedAt > 600) closeMenu();
      else setMenu(name, false);
    });
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenu(name, true);
      }
    });
    if (finePointer) {
      t.addEventListener("mouseenter", function () {
        clearTimeout(leaveTimer);
        clearTimeout(hoverTimer);
        // With a menu already open, moving along the links switches at once.
        hoverTimer = setTimeout(function () {
          if (openName !== name) hoverOpenedAt = Date.now();
          setMenu(name, false);
        }, openName ? 0 : 120);
      });
      t.addEventListener("mouseleave", function () {
        clearTimeout(hoverTimer);
        leaveTimer = setTimeout(function () { closeMenu(); }, 200);
      });
    }
  });
  // A plain link (Plan) closes an open menu, as on harvey.ai.
  if (finePointer && nav) {
    $$(".nav-item:not([data-menu])", nav).forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        clearTimeout(hoverTimer);
        clearTimeout(leaveTimer);
        if (openName) hoverTimer = setTimeout(function () { closeMenu(); }, 80);
      });
    });
  }
  if (shell) {
    shell.addEventListener("mouseenter", function () { clearTimeout(leaveTimer); clearTimeout(hoverTimer); });
    shell.addEventListener("mouseleave", function () {
      if (finePointer) leaveTimer = setTimeout(function () { closeMenu(); }, 200);
    });
  }
  $$("[data-panel]").forEach(function (p) {
    p.addEventListener("keydown", function (e) {
      var links = $$("a", p);
      var i = links.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(true);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var n = links[clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, links.length - 1)];
        n && n.focus();
      }
    });
    p.addEventListener("focusout", function (e) {
      if (!p.contains(e.relatedTarget) && !(e.relatedTarget && e.relatedTarget.closest("[data-menu]"))) closeMenu();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openName) closeMenu(true);
  });
  document.addEventListener("click", function (e) {
    if (openName && !e.target.closest(".topbar")) closeMenu();
  });

  /* ---------- Phone menu ----------
     Opens under the bar (as harvey.ai): the bar stays, and its menu button
     turns into the close button. */
  var mm = $("#mobile-menu");
  var mmBtn = $(".topbar__menu");
  if (mm && mmBtn) {
    // The phone menu carries the same rows as the desktop menus.
    var cloneRows = function (from, to) {
      var host = $("[data-clone='" + to + "']", mm);
      $$(from, document).forEach(function (li) {
        var c = li.cloneNode(true);
        c.classList.remove("menu-cols__phone");
        host.appendChild(c);
      });
    };
    cloneRows("#menu-product .menu-cols > li", "product-rows");
    cloneRows("#menu-company .menu-cols > li", "company-rows");
    var ucHost = $("[data-clone='uc-groups']", mm);
    $$("#menu-usecases .uc-group").forEach(function (g) { ucHost.appendChild(g.cloneNode(true)); });
    var foot = document.createElement("p");
    foot.className = "mm-foot";
    foot.innerHTML = '<a class="text-link" href="/use-cases"><span>See every use case</span><svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>';
    ucHost.appendChild(foot);

    var openMM = function () {
      mm.classList.add("is-open");
      root.classList.add("menu-open");
      mmBtn.setAttribute("aria-expanded", "true");
      mmBtn.setAttribute("aria-label", "Close menu");
      queue();
      setTimeout(function () { var f = $(".mm-row", mm); f && f.focus(); }, 50);
    };
    var closeMM = function (keepFocus) {
      mm.classList.remove("is-open");
      root.classList.remove("menu-open");
      mmBtn.setAttribute("aria-expanded", "false");
      mmBtn.setAttribute("aria-label", "Open menu");
      queue();
      if (!keepFocus) mmBtn.focus();
    };
    mmBtn.addEventListener("click", function () {
      if (mm.classList.contains("is-open")) closeMM();
      else openMM();
    });
    // Focus stays between the menu button and the menu while it is open.
    document.addEventListener("keydown", function (e) {
      if (!mm.classList.contains("is-open")) return;
      if (e.key === "Escape") closeMM();
      if (e.key === "Tab") {
        var f = [mmBtn].concat($$("a[href], button", mm).filter(function (el) { return el.offsetParent !== null; }));
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    });
    $$(".mm-row[aria-controls]", mm).forEach(function (b) {
      b.addEventListener("click", function () {
        var open = b.getAttribute("aria-expanded") !== "true";
        $$(".mm-row[aria-controls]", mm).forEach(function (o) {
          o.setAttribute("aria-expanded", "false");
          $("#" + o.getAttribute("aria-controls")).classList.remove("is-open");
        });
        b.setAttribute("aria-expanded", open ? "true" : "false");
        $("#" + b.getAttribute("aria-controls")).classList.toggle("is-open", open);
      });
    });
    $$("a", mm).forEach(function (a) { a.addEventListener("click", function () { if (a.getAttribute("href").charAt(0) === "#") closeMM(true); }); });
    window.addEventListener("resize", function () { if (window.innerWidth >= 1024 && mm.classList.contains("is-open")) closeMM(true); });
  }

  /* ---------- Questions: one open at a time, the first open on arrival ---------- */
  $$("[data-faq]").forEach(function (faq) {
    var items = $$(".faq-item", faq);
    function setOpen(item, open) {
      var q = $(".faq-q", item);
      var a = $(".faq-a", item);
      q.setAttribute("aria-expanded", open ? "true" : "false");
      item.classList.toggle("is-open", open);
      if (open) {
        a.hidden = false;
        item.classList.add("is-opening");
        setTimeout(function () { item.classList.remove("is-opening"); }, 400);
      } else {
        setTimeout(function () { if (!item.classList.contains("is-open")) a.hidden = true; }, reduced ? 0 : 300);
      }
      window.speedEvents.push({ event: "question_open", page: location.pathname, question: q.id });
    }
    items.forEach(function (item) {
      $(".faq-q", item).addEventListener("click", function () {
        var open = !item.classList.contains("is-open");
        items.forEach(function (o) { if (o !== item && o.classList.contains("is-open")) setOpen(o, false); });
        setOpen(item, open);
      });
    });
  });

  /* ---------- Grow with speed.: the example month as a flow ----------
     One stage pinned under the top bar while the page scrolls past (after
     giga.ai). Each strand is about ₦60,000, and each step makes way for the
     next: it slides to the far left and stays there, faint, as the next one
     grows from where it ended, and leaves when the step after that arrives.
     Revenue: dots drift across the stage, gather by source, and their strands
     run in the source's colour into the Sales node.
     Costs: the sales slide away, taking the node to the left; from it what the
     month costs leaves in red and what is left carries on in graphite, and the
     money saved on apps and leaks bends out of its red branch to join it.
     Result: the costs slide away and what is left splits into what it is made
     of, profit before speed., the savings and the extra sales, then flows into
     the profit, our dot. Wide screens flow left to right, phones top to
     bottom. Reduced motion: no pinning; the pill shows each step finished. */
  var flow = $("#flow");
  if (flow) (function () {
    var NS = "http://www.w3.org/2000/svg";
    var stage = $(".flow__stage", flow);
    var fig = $(".flow__fig", flow);
    var svg = $(".flow__svg", flow);
    var labHost = $(".flow__labels", flow);
    var titles = $$(".flow__title", flow);
    var tabs = $$(".flow__tab", flow);
    var naira = function (n) { return "₦" + Math.round(n).toLocaleString("en-NG"); };
    // On a phone the cost labels share one row, so their figures are short.
    var short = function (n) {
      if (n >= 1e6) return "₦" + (Math.round(n / 1e4) / 100).toString() + "m";
      return "₦" + (Math.round(n / 100) / 10).toString() + "k";
    };
    var ease = function (k) { return 1 - Math.pow(1 - k, 3); };
    // Ease in and out, for things that travel (the dots, the saved strands).
    var glide = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
    var mix = function (a, b, k) { return a + (b - a) * k; };
    var seed = 11;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    var SRC = [
      { v: -0.72, base: 36, add: 2, name: "Every DM answered", short: "DMs" },
      { v: 0, base: 26, add: 1, name: "Quiet buyers followed up", short: "Quiet buyers" },
      { v: 0.72, base: 18, add: 1, name: "Group orders from one link", short: "Group orders" }
    ];
    // What the money becomes. Profit is 7 strands before speed.; the 5 saved
    // on apps and leaks and 1 from the extra sales make it 13 with it.
    var BR = [
      { key: "cogs", v: -0.84, vp: -0.97, base: 48, honest: 2, name: "Cost of goods sold", short: "Goods", from: 2880000, to: 3024000, note: "Up with sales", tone: "" },
      { key: "staff", v: -0.44, vp: -0.4, base: 18, name: "Staff, rent & delivery", short: "Staff & rent", from: 1100000, to: 1100000, note: "No change", tone: "" },
      { key: "profit", v: 0, base: 7, keep: 1 },
      { key: "apps", v: 0.44, vp: 0.4, base: 1, cut: 4, name: "Apps & subscriptions", short: "Apps", from: 295000, to: 62500, note: "−₦232,500", tone: "cut" },
      { key: "waste", v: 0.84, vp: 0.97, base: 1, cut: 1, name: "Waste & leaks", short: "Leaks", from: 120000, to: 60000, note: "−₦60,000", tone: "cut" }
    ];
    var NODE_A = 0.5;
    var LEFT = 0.14;
    var END_B = 0.79;
    // What is left runs on past the cost labels, so its node sits in front of them.
    var END_T = 0.94;
    var PROFIT = 0.66;
    var MID_C = 0.36;
    // The parts of the profit in the result, in the order they sit in the stream.
    var PARTS = [
      { key: "before", v: -0.5, n: 7, name: "Profit before speed.", short: "Before", amt: "₦405,000", cls: "fl-keep" },
      { key: "extra", v: 0, n: 1, name: "From extra sales", short: "Extra sales", amt: "+₦96,000", cls: "fl-keep fl-keep--new" },
      { key: "saved", v: 0.5, n: 5, name: "Saved on apps & leaks", short: "Saved", amt: "+₦292,500", cls: "fl-keep fl-keep--saved" }
    ];

    var W = 0;
    var H = 0;
    var wide = true;
    var map = function (u, v) {
      if (wide) return [u * (W - 210), H / 2 + v * (H / 2 - 28)];
      return [W / 2 + v * (W / 2 - 34), 36 + u * (H - 36 - 118)];
    };
    // How far one step of u is on screen, for sliding a layer along the flow.
    var slide = function (du) {
      return wide ? "translate(" + (du * (W - 210)).toFixed(1) + " 0)" : "translate(0 " + (du * (H - 154)).toFixed(1) + ")";
    };
    var curve = function (u0, v0, u1, v1) {
      var m = u0 + (u1 - u0) * 0.5;
      var a = map(u0, v0), b = map(m, v0), c = map(m, v1), d = map(u1, v1);
      return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "C" + b[0].toFixed(1) + " " + b[1].toFixed(1) + " " + c[0].toFixed(1) + " " + c[1].toFixed(1) + " " + d[0].toFixed(1) + " " + d[1].toFixed(1);
    };
    // Each strand draws with a dash as long as itself (measured, not
    // pathLength, which older Safari ignores for dashes).
    var layer = svg;
    var mkPath = function (d, cls) {
      var el = document.createElementNS(NS, "path");
      el.setAttribute("d", d);
      el.setAttribute("class", cls);
      layer.appendChild(el);
      el._d = d;
      el._len = (el.getTotalLength ? el.getTotalLength() : 2000) + 2;
      el.setAttribute("stroke-dasharray", el._len + " " + el._len);
      el.setAttribute("stroke-dashoffset", el._len);
      return el;
    };
    // A strand that has not started is hidden outright, so its round cap
    // never shows as a stray dot.
    var stroke = function (el, f, op) {
      el.setAttribute("stroke-dashoffset", ((1 - f) * el._len).toFixed(2));
      el.style.opacity = f > 0.002 ? op : 0;
    };
    var setClass = function (el, cls) {
      if (el._cls !== cls) {
        el._cls = cls;
        el.setAttribute("class", cls);
      }
    };
    var mkLab = function (cls, html) {
      var el = document.createElement("div");
      el.className = "flow__lab " + cls;
      el.innerHTML = html;
      labHost.appendChild(el);
      return el;
    };
    var place = function (el, xy, tx, ty, op) {
      el.style.transform = "translate(" + xy[0].toFixed(1) + "px," + xy[1].toFixed(1) + "px) translate(" + tx + "," + ty + ")";
      el.style.opacity = op.toFixed(3);
    };

    var A = [];
    var B = [];
    var C = [];
    var gA;
    var gB;
    var gC;
    var labs = {};
    var nodeA;
    var nodeT;
    var nodeP;
    var build = function () {
      W = fig.clientWidth;
      H = fig.clientHeight;
      if (!W || !H) return;
      wide = W / H > 1.15;
      END_B = wide ? 0.79 : 0.66;
      END_T = END_B + (wide ? 170 / (W - 210) : 0.11);
      PROFIT = wide ? 0.66 : 0.8;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.textContent = "";
      labHost.textContent = "";
      A = [];
      B = [];
      C = [];
      labs = {};
      seed = 11;
      var mkG = function () { var g = document.createElementNS(NS, "g"); svg.appendChild(g); return g; };
      gA = mkG();
      gB = mkG();
      gC = mkG();
      layer = gA;
      // Revenue: each dot starts somewhere across the stage, drifting, then
      // flies to the head of its source's column; its strand runs in the
      // source's colour into the Sales node.
      var total = SRC.reduce(function (n, g) { return n + g.base + g.add; }, 0);
      var k = 0;
      SRC.forEach(function (g, gi) {
        var n = g.base + g.add;
        for (var j = 0; j < n; j++) {
          var isNew = j >= g.base;
          var u0 = Math.floor(rnd() * 4) * 0.03;
          var v0 = g.v + (j - n / 2) * (wide ? 0.011 : 0.006);
          var v1 = (k - total / 2) * 0.0014;
          var el = mkPath(curve(u0, v0, NODE_A, v1), "fl-src fl-g" + gi + (isNew ? " fl-src--new" : ""));
          var dot = document.createElementNS(NS, "circle");
          dot.setAttribute("class", "fl-dot fl-dot--g" + gi);
          gA.appendChild(dot);
          A.push({
            el: el,
            dot: dot,
            isNew: isNew,
            d: (k / total) * 0.05,
            home: map(u0, v0),
            far: [16 + rnd() * (W - 32), 52 + rnd() * (H - 68)],
            ph: rnd() * Math.PI * 2,
            sp: 0.35 + rnd() * 0.5,
            amp: 6 + rnd() * 14
          });
          k++;
        }
        labs["src" + gi] = { el: mkLab("flow__lab--src", wide ? g.name : g.short), at: [0, g.v - n * (wide ? 0.0055 : 0)], kind: "src" };
      });
      labs.legend = {
        el: mkLab("flow__legend", SRC.map(function (g, gi) { return '<span><i class="g' + gi + '"></i>' + (wide ? g.name : g.short) + "</span>"; }).join("")),
        kind: "legend"
      };
      // Costs and what is left, grown from the node once it has moved left.
      layer = gB;
      var M = BR.reduce(function (n, b) { return n + b.base + (b.honest || 0) + (b.cut || 0) + (b.keep || 0); }, 0);
      var m = 0;
      var saved = 0;
      var profitN = BR[2].base + BR[2].keep + BR[3].cut + BR[4].cut;
      var pj = 0;
      BR.forEach(function (br) {
        var parts = [["base", br.base], ["honest", br.honest || 0], ["cut", br.cut || 0], ["keep", br.keep || 0]];
        var n = br.base + (br.honest || 0) + (br.cut || 0) + (br.keep || 0);
        var j = 0;
        parts.forEach(function (pt) {
          for (var q = 0; q < pt[1]; q++) {
            var v0 = (m - M / 2) * 0.0014;
            var isProfit = br.key === "profit";
            var s = { br: br.key, part: pt[0], d: (m / M) * 0.04, v0: v0 };
            if (isProfit || pt[0] === "cut") {
              // A place in the profit bundle, kept for the saved strands too.
              s.pv = (pj - profitN / 2) * 0.0045;
              pj++;
            }
            if (isProfit) {
              s.el = mkPath(curve(LEFT, v0, END_T, s.pv), pt[0] === "keep" ? "fl-keep fl-keep--new" : "fl-profit");
            } else {
              s.cv = (wide ? br.v : br.vp) + (j - n / 2) * (wide ? 0.0068 : 0.004);
              s.el = mkPath(curve(LEFT, v0, END_B, s.cv), pt[0] === "honest" ? "fl-cost fl-cost--honest" : "fl-cost");
              if (pt[0] === "cut") s.i = saved++;
            }
            B.push(s);
            m++;
            j++;
          }
        });
        if (br.name) {
          labs[br.key] = {
            el: mkLab("", "<b>" + (wide ? br.name : br.short) + '</b><span class="amt">' + naira(br.from) + '</span><span class="note' + (br.tone ? " note--" + br.tone : "") + '">' + br.note + "</span>"),
            at: [END_B, wide ? br.v : br.vp],
            kind: "branch",
            br: br
          };
        }
      });
      // The result: the end of what is left becomes the start, splits into
      // its parts and flows into the profit.
      layer = gC;
      var order = [];
      B.forEach(function (s) { if (s.pv !== undefined) order.push(s); });
      order.sort(function (x, y) { return x.pv - y.pv; });
      var pi = 0;
      PARTS.forEach(function (part) {
        for (var q = 0; q < part.n; q++) {
          var sv = order[pi] ? order[pi].pv : 0;
          var gv = (wide ? part.v : part.v * 1.4) + (q - part.n / 2) * (wide ? 0.012 : 0.008);
          var end = (pi - 6.5) * 0.004;
          var d2 = curve(MID_C, gv, PROFIT, end);
          C.push({ el: mkPath(curve(LEFT, sv, MID_C, gv) + " " + d2.replace("M", "L"), part.cls), d: (pi / 13) * 0.03 });
          pi++;
        }
        labs["part-" + part.key] = {
          el: mkLab("", "<b>" + (wide ? part.name : part.short) + '</b><span class="amt">' + part.amt + "</span>"),
          // Wide: over each bundle (under the lowest). Phone: beside the outer
          // bundles, and the extra sales lower down between the curves.
          at: wide ? [MID_C, part.v + (part.v > 0 ? 1 : -1) * (part.n / 2) * 0.012] : part.v === 0 ? [0.56, 0] : [MID_C, part.v * 1.4 + (part.v > 0 ? 0.04 : -0.04)],
          anchor: wide ? (part.v > 0 ? ["-50%", "10px"] : ["-50%", "calc(-100% - 8px)"]) : part.v < 0 ? ["calc(-100% - 6px)", "-50%"] : part.v > 0 ? ["6px", "-50%"] : ["-50%", "-50%"],
          kind: "part"
        };
      });
      nodeA = document.createElement("span");
      nodeA.className = "flow__node";
      labHost.appendChild(nodeA);
      // Where what is left gathers at the end of the costs; it carries the
      // flow into the result, as the Sales node carries it into the costs.
      nodeT = document.createElement("span");
      nodeT.className = "flow__node";
      labHost.appendChild(nodeT);
      labs.toProfit = { el: mkLab("flow__lab--to", "<b>To profit →</b>"), kind: "to" };
      nodeP = document.createElement("span");
      nodeP.className = "flow__node flow__node--profit";
      labHost.appendChild(nodeP);
      labs.sales = { el: mkLab("flow__lab--big", '<b>Sales</b><span class="amt">₦4,800,000</span><span class="note note--rev">+₦240,000</span>'), kind: "sales" };
      labs.profit = { el: mkLab("flow__lab--big", '<b>Profit</b><span class="amt">₦405,000</span><span class="note note--keep">Almost double</span><span class="hours">Admin hours: 30 → 10 a week</span>'), kind: "profit" };
      labs.profit.el.classList.toggle("is-centred", !wide);
      draw(lastP);
    };

    var lastP = 0;
    var phase = -1;
    var draw = function (p, now) {
      lastP = p;
      if (!W) return;
      var t = (now || 0) / 1000;
      // Each step makes way for the next: it slides to the far left and stays
      // there, faint, behind the step that grows from it.
      var FAINT = 0.22;
      var outA = glide(seg(p, 0.27, 0.37));
      var outB = glide(seg(p, 0.62, 0.72));
      var shiftA = -(NODE_A - LEFT) * outA;
      var shiftB = -(END_T - LEFT) * outB;
      gA.setAttribute("transform", slide(shiftA));
      // Only the step just before stays faint; the one before that leaves.
      gA.style.opacity = ((1 - (1 - FAINT) * outA) * (1 - outB)).toFixed(3);
      // The next step's strands ride with the node they come out of, so they
      // grow from it even while it is still sliding into place.
      var offB = (NODE_A - LEFT) * (1 - outA) + shiftB;
      var offC = (END_T - LEFT) * (1 - outB);
      gB.setAttribute("transform", slide(offB));
      gC.setAttribute("transform", slide(offC));
      gB.style.opacity = (1 - (1 - FAINT) * outB).toFixed(3);
      fig.classList.toggle("is-past", outA > 0.02);

      // Revenue: the dots gather, then their strands run into the Sales node.
      A.forEach(function (s) {
        var g = glide(seg(p, 0.015 + s.d * 0.7, 0.1 + s.d * 0.7));
        var loose = (1 - g) * (reduced ? 0 : 1);
        var x = mix(s.far[0], s.home[0], g) + Math.sin(t * s.sp + s.ph) * s.amp * loose;
        var y = mix(s.far[1], s.home[1], g) + Math.cos(t * s.sp * 0.8 + s.ph) * s.amp * loose;
        s.dot.setAttribute("cx", x.toFixed(1));
        s.dot.setAttribute("cy", y.toFixed(1));
        s.dot.setAttribute("r", mix(3.2, 1.6, g).toFixed(2));
        var f = s.isNew ? ease(seg(p, 0.18, 0.24)) : ease(seg(p, 0.1 + s.d * 0.7, 0.19 + s.d * 0.7));
        stroke(s.el, f, 1);
      });
      var lg = labs.legend.el;
      lg.style.opacity = (1 - seg(p, 0.05, 0.1)).toFixed(3);
      lg.style.transform = "translate(" + (W / 2).toFixed(1) + "px,12px) translate(-50%,0)";
      Object.keys(labs).forEach(function (key) {
        var L = labs[key];
        if (L.kind !== "src") return;
        var xy = map(L.at[0] + shiftA, L.at[1]);
        var op = seg(p, 0.08, 0.13) * (1 - (1 - FAINT) * outA) * (1 - outB);
        if (wide) place(L.el, xy, "0px", "calc(-100% - 10px)", op);
        else place(L.el, xy, "-50%", "calc(-100% - 8px)", op);
      });
      // The Sales node travels left with the sales, then away with the costs.
      var nxy = map(NODE_A + shiftA + shiftB, 0);
      place(nodeA, nxy, "0px", "0px", seg(p, 0.1, 0.15) * (1 - (1 - FAINT) * outB));
      var salesK = ease(seg(p, 0.18, 0.24));
      var sl = labs.sales.el;
      sl.querySelector(".amt").textContent = naira(mix(4800000, 5040000, salesK));
      sl.querySelector(".note").style.opacity = salesK;
      var salesOp = seg(p, 0.1, 0.15) * (1 - (1 - FAINT) * outB);
      if (!wide) place(sl, nxy, "18px", "-50%", salesOp);
      else if (outA < 0.5) place(sl, nxy, "22px", "-50%", salesOp);
      else place(sl, nxy, "-50%", "26px", salesOp);

      // Costs: red branches, what is left in graphite, the savings bending over.
      B.forEach(function (s) {
        var f = ease(seg(p, 0.34 + s.d, 0.46 + s.d));
        if (s.br === "profit") {
          stroke(s.el, f, 1);
          return;
        }
        if (s.part === "cut") {
          var k = glide(seg(p, 0.48 + s.i * 0.014, 0.58 + s.i * 0.014));
          if (k > 0) {
            s.el.setAttribute("d", curve(LEFT, s.v0, mix(END_B, END_T, k), mix(s.cv, s.pv, k)));
            s.el.setAttribute("stroke-dasharray", "none");
            s.el.style.opacity = 1;
            setClass(s.el, k > 0.35 ? "fl-keep fl-keep--saved" : "fl-cost");
          } else {
            if (s.el.getAttribute("d") !== s.el._d) s.el.setAttribute("d", s.el._d);
            s.el.setAttribute("stroke-dasharray", s.el._len + " " + s.el._len);
            setClass(s.el, "fl-cost");
            stroke(s.el, f, 1);
          }
          return;
        }
        if (s.part === "honest") f = ease(seg(p, 0.48, 0.56));
        stroke(s.el, f, 1);
      });
      var costK = ease(seg(p, 0.48, 0.6));
      BR.forEach(function (br) {
        var L = labs[br.key];
        if (!L || L.kind !== "branch") return;
        L.el.querySelector(".amt").textContent = (wide ? naira : short)(mix(br.from, br.to, costK));
        L.el.querySelector(".note").style.opacity = br.key === "staff" ? 1 : costK;
        L.el.classList.toggle("is-cut", br.tone === "cut" && costK > 0.5);
        var xy = map(L.at[0] + offB, L.at[1]);
        var op = seg(p, 0.38, 0.45) * (1 - (1 - FAINT) * outB);
        if (wide) place(L.el, xy, "12px", "-50%", op);
        else place(L.el, xy, "-50%", "10px", op);
      });

      // The end of the costs travels left and becomes the start of the result.
      var txy = map(END_T + shiftB, 0);
      place(nodeT, txy, "0px", "0px", seg(p, 0.44, 0.5));
      if (wide) place(labs.toProfit.el, txy, "18px", "-50%", seg(p, 0.46, 0.52) * (1 - outB));
      else place(labs.toProfit.el, txy, "-50%", "18px", seg(p, 0.46, 0.52) * (1 - outB));

      // Result: what is left splits into its parts and flows into the profit.
      C.forEach(function (s) { stroke(s.el, ease(seg(p, 0.68 + s.d, 0.82 + s.d)), 1); });
      PARTS.forEach(function (part) {
        var L = labs["part-" + part.key];
        var xy = map(L.at[0] + offC, L.at[1]);
        var op = seg(p, 0.74, 0.8);
        place(L.el, xy, L.anchor[0], L.anchor[1], op);
      });
      var pxy = map(PROFIT, 0);
      nodeP.style.transform = "translate(" + pxy[0].toFixed(1) + "px," + pxy[1].toFixed(1) + "px) scale(" + mix(0.4, 1, ease(seg(p, 0.8, 0.85))).toFixed(3) + ")";
      nodeP.style.opacity = seg(p, 0.8, 0.84).toFixed(3);
      var pl = labs.profit.el;
      var profitK = ease(seg(p, 0.82, 0.92));
      pl.querySelector(".amt").textContent = naira(mix(405000, 793500, profitK));
      pl.querySelector(".note").style.opacity = profitK;
      pl.querySelector(".hours").style.opacity = seg(p, 0.92, 0.97);
      if (wide) place(pl, pxy, "26px", "-50%", seg(p, 0.8, 0.85));
      else place(pl, pxy, "-50%", "22px", seg(p, 0.8, 0.85));
      // The word, the line and the pill follow the step.
      var ph = p < 0.31 ? 0 : p < 0.66 ? 1 : 2;
      if (ph !== phase) {
        phase = ph;
        titles.forEach(function (tt, i) { tt.classList.toggle("is-on", i === ph); });
        tabs.forEach(function (tb, i) {
          tb.classList.toggle("is-on", i === ph);
          tb.setAttribute("aria-pressed", i === ph ? "true" : "false");
        });
      }
    };

    var STOPS = [0.26, 0.61, 1];
    var runLen = function () { return flow.offsetHeight - stage.offsetHeight; };
    var topOff = function () { return parseFloat(getComputedStyle(stage).top) || 0; };
    // Smoothing: the drawing glides after the scroll position instead of
    // jumping with each wheel step, and keeps running while the scattered
    // dots are on screen so they can drift.
    var target = 0;
    var shown = 0;
    var running = false;
    var lastT = 0;
    var onScreen = false;
    var loop = function (now) {
      var dt = lastT ? Math.min(64, now - lastT) : 16;
      lastT = now;
      shown += (target - shown) * (1 - Math.exp(-dt / 160));
      if (Math.abs(target - shown) < 0.0003) shown = target;
      draw(shown, now);
      if (shown !== target || (onScreen && shown < 0.12)) requestAnimationFrame(loop);
      else {
        running = false;
        lastT = 0;
      }
    };
    var kick = function () {
      if (running || reduced) return;
      running = true;
      requestAnimationFrame(loop);
    };
    if (!reduced) {
      frameFns.push(function () {
        var r = flow.getBoundingClientRect();
        var p = clamp((topOff() - r.top) / Math.max(1, runLen()), 0, 1);
        if (p !== target || phase < 0) {
          target = p;
          kick();
        }
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (en) {
          onScreen = en[0].isIntersecting;
          if (onScreen) kick();
        }).observe(stage);
      }
    } else {
      lastP = STOPS[0];
    }
    tabs.forEach(function (tb, i) {
      tb.addEventListener("click", function () {
        if (reduced) {
          draw(STOPS[i]);
          return;
        }
        var y = flow.getBoundingClientRect().top + window.scrollY - topOff() + STOPS[i] * runLen();
        window.scrollTo({ top: y, behavior: "smooth" });
      });
    });
    build();
    resizeFns.push(build);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  })();

  /* ---------- Switching: three cards and the scenes on the photograph ----------
     As on deel.com: the card shown is raised, and its photograph and scene
     come up together. While the band is on screen it moves on to the next card by itself
     (a volt line times it); pointing at a card shows it and pauses, and a
     click or a focused link stops the turning for good. The Move-in card
     plays each time its scene comes on: each part of the business comes
     across in turn, its bar fills, its count rises and it is ticked off.
     Reduced motion: no turning, and every scene shows finished. */
  var sw = $("#switch");
  if (sw) (function () {
    var cards = $$(".switch__card", sw);
    var scenes = $$(".sw-scene", sw);
    var photos = $$(".sw-photo", sw);
    var movein = $("#movein");
    var rows = $$(".movein__row", movein);
    var pctEl = $(".movein__pct-n", movein);
    var DWELL = 7000;
    var current = 0;
    var auto = !reduced;
    var paused = false;
    var inView = false;
    var started = false;
    var elapsed = 0;
    var last = 0;
    var raf = 0;
    var liveTimer = 0;
    var moveRaf = 0;

    var fmt = function (row, n) {
      return row.hasAttribute("data-naira") ? "₦" + Math.round(n).toLocaleString("en-NG") : Math.round(n).toLocaleString("en-NG");
    };
    var moveinAt = function (t) {
      // t in ms from the start; -1 means finished.
      var each = 900;
      var gap = 180;
      var total = rows.length * (each + gap) - gap;
      if (t < 0) t = total;
      rows.forEach(function (r, i) {
        var k = clamp((t - i * (each + gap)) / each, 0, 1);
        var e = 1 - Math.pow(1 - k, 3);
        r.style.setProperty("--k", e.toFixed(3));
        $(".movein__n", r).textContent = fmt(r, e * +r.getAttribute("data-to"));
        r.classList.toggle("is-done", k >= 1);
      });
      pctEl.textContent = String(Math.round(clamp(t / total, 0, 1) * 100));
      movein.classList.toggle("is-done", t >= total);
      return t < total;
    };
    var playMovein = function () {
      cancelAnimationFrame(moveRaf);
      if (reduced) return moveinAt(-1);
      var t0 = performance.now() + 500;
      moveinAt(0);
      var step = function (now) {
        if (moveinAt(Math.max(0, now - t0))) moveRaf = requestAnimationFrame(step);
      };
      moveRaf = requestAnimationFrame(step);
    };

    var show = function (i) {
      current = i;
      elapsed = 0;
      cards.forEach(function (c, j) {
        c.classList.toggle("is-on", j === i);
        c.style.removeProperty("--t");
        $(".switch__time i", c).style.removeProperty("--t");
      });
      clearTimeout(liveTimer);
      scenes.forEach(function (s, j) {
        s.classList.toggle("is-on", j === i);
        s.classList.remove("is-live");
      });
      photos.forEach(function (ph, j) { ph.classList.toggle("is-on", j === i); });
      // The toggles flip and the colour is picked a moment after the cards land.
      liveTimer = setTimeout(function () { scenes[i].classList.add("is-live"); }, reduced ? 0 : 1100);
      if (i === 0) playMovein();
    };
    var stopAuto = function () {
      auto = false;
      sw.classList.remove("is-auto");
    };

    var tick = function (now) {
      raf = 0;
      if (!auto || !inView) return;
      var dt = last ? now - last : 0;
      last = now;
      if (!paused) elapsed += dt;
      if (elapsed >= DWELL) show((current + 1) % cards.length);
      $(".switch__time i", cards[current]).style.setProperty("--t", (elapsed / DWELL).toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    var run = function () {
      if (!raf && auto && inView) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    cards.forEach(function (c, i) {
      c.addEventListener("click", function () {
        stopAuto();
        if (current !== i) show(i);
      });
      c.addEventListener("focusin", function () {
        stopAuto();
        if (current !== i) show(i);
      });
      if (finePointer) {
        c.addEventListener("mouseenter", function () {
          paused = true;
          if (current !== i) show(i);
        });
        c.addEventListener("mouseleave", function () { paused = false; });
      }
    });
    var frame = $(".switch__frame", sw);
    if (frame && finePointer) {
      frame.addEventListener("mouseenter", function () { paused = true; });
      frame.addEventListener("mouseleave", function () { paused = false; });
    }

    if (auto) sw.classList.add("is-auto");
    if (reduced || !("IntersectionObserver" in window)) {
      show(0);
      return;
    }
    // The first scene starts once the photograph is in view; the turning only
    // runs while the band is on screen.
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        inView = e.isIntersecting;
        if (inView && !started) {
          started = true;
          show(0);
        }
        if (inView) run();
      });
    }, { threshold: 0.35 }).observe(frame || sw);
  })();

  /* ---------- Footer: accordion columns on phones ---------- */
  $$(".footer__acc").forEach(function (b) {
    b.addEventListener("click", function () {
      var col = b.closest(".footer__col");
      var open = !col.classList.contains("is-open");
      $$(".footer__col").forEach(function (c) {
        c.classList.remove("is-open");
        var x = $(".footer__acc", c);
        x && x.setAttribute("aria-expanded", "false");
      });
      col.classList.toggle("is-open", open);
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------- Public hooks for page scripts ---------- */
  window.Speed = {
    reduced: reduced,
    finePointer: finePointer,
    onFrame: function (fn) { frameFns.unshift(fn); queue(); },
    onResize: function (fn) { resizeFns.push(fn); },
    setToneResolver: function (fn) { toneResolver = fn; queue(); },
    refresh: queue,
    clamp: clamp
  };
  queue();
})();
