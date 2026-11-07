/* Home: the light journey (THE LIGHT ON SCROLL), the chapter tab bar and the
   small moment inside each chapter. Runs on Speed.onFrame from site.js, so the
   page reads the scroll once per frame and only animates transform, opacity
   and the iris's clip-path. */
(function () {
  "use strict";
  if (!window.Speed) return;
  var S = window.Speed;
  var reduced = S.reduced;
  var clamp = S.clamp;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  var hero = $(".hero");
  var journey = $("#journey");
  var chapters = $$(".chapter");
  var fills = $$("#journey-colors i");
  var light = $("#light");
  var solid = $("#light-solid");
  var twin = $("#twin-dot");
  var topbar = $("#topbar");
  var tabbar = $("#tabbar");
  var hasTabbar = !!tabbar && !tabbar.hidden;
  var tabs = $$("[data-tab]");
  var stroke = $(".tabbar__stroke");
  var ch5 = $(".ch-5");
  if (!hero || !journey || chapters.length !== 10) return;
  var el = {
    glowVolt: $(".light__glow--volt", light),
    glowCyan: $(".light__glow--cyan", light),
    glowHalo: $(".light__glow--halo", light),
    ellipse: $(".light__ellipse", light),
    beam: $(".light__beam", light),
    dot: $(".light__dot", solid),
    iris: $(".light__iris", solid),
    wmDot: $(".topbar .wm-dot"),
    stretch: $(".ch-1 .stretch-stroke"),
    stage: $(".hero__stage"),
    night: $(".hero__night"),
    beamTargets: [1, 2, 3].map(function (i) { return $(".beam-target", chapters[i]); })
  };

  /* What the light looks like in each chapter (index 0 = chapter 1). */
  var STAGES = {
    dot: [10, 14, 18, 24, 32, 40, 56, 72, 72, 72],
    voltR: [120, 160, 200, 260, 300, 160, 0, 0, 0, 0],
    voltO: [0.35, 0.3, 0.28, 0.25, 0.2, 0, 0, 0, 0, 0],
    cyanR: [0, 60, 320, 520, 640, 300, 0, 0, 0, 0],
    cyanO: [0, 0, 0.14, 0.24, 0.22, 0, 0, 0, 0, 0],
    ellO: [0, 0, 0, 0.15, 1, 0, 0, 0, 0, 0],
    haloR: [0, 0, 0, 0, 0, 480, 640, 800, 800, 0],
    haloO: [0, 0, 0, 0, 0, 0.3, 0.32, 0.35, 0.35, 0]
  };
  var BEAM = {
    1: { core: 2, haze: 40, color: "rgba(212, 246, 79, 0.2)" },
    2: { core: 4, haze: 200, color: "rgba(15, 169, 202, 0.22)" },
    3: { core: 4, haze: 320, color: "rgba(127, 217, 232, 0.2)" }
  };
  function stageVal(key, s) {
    var arr = STAGES[key];
    var i = Math.floor(clamp(s, 0, 9));
    var f = clamp(s - i, 0, 1);
    return lerp(arr[i], arr[Math.min(i + 1, 9)], f);
  }

  /* ---------- Layout cache ---------- */
  var L = {};
  function measure() {
    var vw = window.innerWidth;
    var y = window.scrollY;
    L.vw = vw;
    L.desktop = vw >= 1024;
    L.tops = chapters.map(function (c) { return c.getBoundingClientRect().top + y; });
    L.heroH = hero.offsetHeight;
    L.stageH = el.stage ? el.stage.offsetHeight : window.innerHeight;
    var cw = vw >= 1024 ? Math.min(1320, vw - 120) : vw >= 768 ? vw - 64 : vw - 40;
    var colW = (cw - 11 * 24) / 12;
    var left = (vw - cw) / 2;
    L.dotX = vw >= 1024 ? left + 10 * (colW + 24) + colW / 2 : vw - (vw >= 768 ? 44 : 28);
    L.dotY = vw >= 1024 ? 178 : 152;
    L.arc = vw >= 1024 ? 96 : 40;
    light.style.setProperty("--lx", L.dotX + "px");
    light.style.setProperty("--ly", L.dotY + "px");
    solid.style.setProperty("--lx", L.dotX + "px");
    solid.style.setProperty("--ly", L.dotY + "px");
    buildBlueprint();
    positionStroke(activeTab, false);
  }

  /* ---------- State shared with the tone resolver ---------- */
  var state = { iris: 0, irisR: 0, t9: 0 };

  S.setToneResolver(function (y) {
    var hr = hero.getBoundingClientRect();
    if (y < hr.bottom) return "dark";
    var jr = journey.getBoundingClientRect();
    if (y < jr.top || y >= jr.bottom) return null;
    var c5 = ch5.getBoundingClientRect();
    if (y < c5.bottom + L.arc) return "dark";
    if (state.iris >= 1 && state.t9 < 0.5) return "volt";
    if (state.iris > 0 && state.iris < 1) {
      var dx = L.vw / 2 - L.dotX;
      var dy = y - L.dotY;
      if (Math.sqrt(dx * dx + dy * dy) < state.irisR) return "volt";
    }
    return "light";
  });

  /* ---------- The frame ---------- */
  var activeTab = 0;
  var lastY = window.scrollY;
  var barHidden = false;
  var hashOn = false;
  var tabTone = "";

  S.onFrame(function (y, vh) {
    var vw = L.vw;
    var top = function (i) { return L.tops[i] - y; };

    // Boundary k (0..8) sits between chapter k+1 and k+2.
    var t = [];
    for (var k = 0; k < 9; k++) {
      var B = top(k + 1);
      var v = clamp((0.6 * vh - B) / (0.2 * vh), 0, 1);
      if (k === 7) v = clamp((vh - B) / (0.7 * vh), 0, 1); // 8 -> 9 is the iris, over a longer band
      if (reduced) v = v >= 0.5 ? 1 : 0;
      t.push(v);
    }
    var c5top = ch5.getBoundingClientRect().top;
    var cyanOn = c5top + (L.desktop ? 240 : 160) <= 0 ? 1 : 0;

    // Colour layer: stacked fills, only opacity changes.
    for (var j = 1; j < 10; j++) {
      var o = t[j - 1];
      if (j === 4) o = 0; // chapter 5 paints its own lagoon panel
      if (j === 5) o = cyanOn; // revealed under chapter 5's curved edge
      if (j === 8) o = t[7] >= 1 ? 1 : 0; // volt arrives as the iris
      fills[j].style.opacity = o;
    }

    // How far along the journey the light is (0 = chapter 1 ... 9 = chapter 10).
    var s = 0;
    for (var m = 0; m < 9; m++) s += t[m];

    // Night falls over the still hero photo as the words scroll away: fully
    // dark when the photo lets go (giga.ai).
    if (el.night) {
      var heroRun = Math.max(1, L.heroH - vh);
      el.night.style.setProperty("--night", Math.pow(clamp(y / heroRun, 0, 1), 1.6).toFixed(3));
    }

    // The twin dot leaves the wordmark as the hero's last screen scrolls away.
    var q = clamp((y - (L.heroH - vh * 0.5)) / (vh * 0.5), 0, 1);
    var jr = journey.getBoundingClientRect();
    var inJourney = jr.top < vh && jr.bottom > 0;
    light.classList.toggle("is-on", inJourney && q > 0);
    solid.classList.toggle("is-on", inJourney && q > 0);

    if (!reduced && q > 0 && q < 1) {
      var wm = el.wmDot;
      var r = wm ? wm.getBoundingClientRect() : { left: vw / 2, top: 40, width: 4, height: 4 };
      var sx = r.left + r.width / 2;
      var sy = r.top + r.height / 2;
      var e = q * q * (3 - 2 * q);
      var cx = lerp(sx, L.dotX, 0.7);
      var cy = sy + 220;
      var bx = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * L.dotX;
      var by = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * L.dotY;
      twin.style.opacity = 1;
      twin.style.transform = "translate(" + bx.toFixed(1) + "px," + by.toFixed(1) + "px) scale(" + lerp(0.8, 1, e).toFixed(3) + ")";
    } else {
      twin.style.opacity = 0;
    }
    var arrived = reduced ? (q > 0 ? 1 : 0) : q >= 1 ? 1 : 0;
    var glowIn = reduced ? arrived : clamp((q - 0.7) / 0.3, 0, 1);

    // Glows
    var set = function (el, R, O) {
      el.style.setProperty("--s", (Math.max(R, 1) / 1000).toFixed(4));
      el.style.setProperty("--o", (O * glowIn).toFixed(3));
    };
    var sv = reduced ? Math.round(s) : s;
    set(el.glowVolt, stageVal("voltR", sv), stageVal("voltO", sv));
    set(el.glowCyan, stageVal("cyanR", sv), stageVal("cyanO", sv));
    set(el.glowHalo, stageVal("haloR", sv), stageVal("haloO", sv));
    el.ellipse.style.setProperty("--o", (stageVal("ellO", sv) * glowIn).toFixed(3));

    // The dot: grows with the colour, sits on its graphite setting once the page is light.
    var size = stageVal("dot", sv) * (vw < 768 ? 0.6 : 1);
    var ds = size / 80;
    var lightBg = clamp((sv - 4.5) / 0.5, 0, 1);
    var dot = el.dot;
    dot.style.setProperty("--ds", ds.toFixed(4));
    dot.style.setProperty("--setting", ((4 / ds) * lightBg).toFixed(2) + "px");
    dot.style.setProperty("--dot-glow", (1 - lightBg * 0.5).toFixed(2));

    // Chapter 9: the dot opens like an iris until volt covers the screen.
    var p = t[7];
    var maxR = Math.sqrt(Math.pow(Math.max(L.dotX, vw - L.dotX), 2) + Math.pow(Math.max(L.dotY, vh - L.dotY), 2));
    var irisR = lerp(size / 2, maxR, p * p);
    state.iris = p;
    state.irisR = irisR;
    state.t9 = t[8];
    var iris = el.iris;
    iris.style.setProperty("--ir", irisR.toFixed(1) + "px");
    iris.style.setProperty("--io", p > 0 && p < 1 && !reduced ? 1 : 0);
    dot.style.setProperty("--do", (arrived * (p >= 1 ? 0 : 1)).toFixed(2));

    // The beam (chapters 2 to 4, desktop only): from the dot to the picture's top edge.
    var beamEl = el.beam;
    var bo = 0;
    for (var bi = 1; bi <= 3; bi++) {
      var target = el.beamTargets[bi - 1];
      if (!target) continue;
      var near = clamp(1 - Math.abs(sv - bi) * 1.6, 0, 1);
      var tt = target.getBoundingClientRect().top;
      var len = tt - L.dotY;
      var o2 = L.desktop && len > 40 ? near * clamp((len - 40) / 80, 0, 1) : 0;
      target.style.setProperty("--rim", o2.toFixed(2));
      if (o2 > bo) {
        bo = o2;
        var b = BEAM[bi];
        beamEl.style.setProperty("--bl", (len / 1000).toFixed(4));
        beamEl.style.setProperty("--bc", b.core + "px");
        beamEl.style.setProperty("--bh", b.haze + "px");
        beamEl.style.setProperty("--haze", b.color);
      }
    }
    beamEl.style.setProperty("--bo", (bo * glowIn).toFixed(3));

    // Chapter tab bar: active chapter, its stroke, pinned state and tone.
    var active = 0;
    for (var a = 0; a < 10; a++) if (top(a) <= vh * 0.5) active = a;
    if (active !== activeTab) setActive(active);
    var inChapters = top(0) <= vh * 0.5 && jr.bottom > vh * 0.5;
    if (inChapters !== hashOn || (inChapters && location.hash !== "#" + chapters[active].id)) {
      hashOn = inChapters;
      try {
        history.replaceState(null, "", inChapters ? "#" + chapters[active].id : location.pathname + location.search);
      } catch (err) { /* file:// */ }
    }
    if (hasTabbar) {
      var tabTop = parseFloat(getComputedStyle(tabbar).top) || 74;
      var pinned = tabbar.getBoundingClientRect().top <= tabTop + 1 && jr.bottom > tabTop + 56;
      tabbar.classList.toggle("is-pinned", pinned);

      // While the tab bar is pinned on desktop, scrolling down slides the slim bar away.
      var dy = y - lastY;
      lastY = y;
      if (L.desktop && pinned && dy > 4 && !barHidden) barHidden = true;
      else if ((dy < -4 || !pinned || !L.desktop) && barHidden) barHidden = false;
      topbar.classList.toggle("is-hidden", barHidden);
      tabbar.style.setProperty("--tab-top", (L.desktop ? (barHidden ? 16 : 74) : 76) + "px");

      var tY = tabbar.getBoundingClientRect().top + 28;
      var tone = tY < ch5.getBoundingClientRect().bottom + L.arc ? "dark" : "light";
      if (tone !== tabTone) {
        tabTone = tone;
        tabbar.setAttribute("data-tone", tone);
      }
    }

    // Chapter 1's stretched stroke slides with the scroll.
    if (!reduced) {
      var st = el.stretch;
      var c1 = chapters[0].getBoundingClientRect();
      st.style.setProperty("--shift", (clamp((vh - c1.top) / (vh + c1.height), 0, 1) * 40).toFixed(1) + "px");
    }
  });

  /* ---------- Tabs ---------- */
  function positionStroke(i, stretch) {
    if (!hasTabbar) return;
    var tab = tabs[i];
    if (!tab || !stroke) return;
    var x = tab.offsetLeft + tab.offsetWidth / 2 - 12;
    stroke.style.setProperty("--sx", x + "px");
    if (stretch && !reduced) {
      stroke.style.setProperty("--sw", "1.66");
      setTimeout(function () { stroke.style.setProperty("--sw", "1"); }, 150);
    }
  }
  function setActive(i) {
    activeTab = i;
    tabs.forEach(function (t, n) {
      if (n === i) t.setAttribute("aria-current", "location");
      else t.removeAttribute("aria-current");
    });
    positionStroke(i, true);
    if (hasTabbar && tabbar.scrollWidth > tabbar.clientWidth + 2) {
      tabbar.scrollTo({ left: Math.max(0, tabs[i].offsetLeft - 20), behavior: reduced ? "auto" : "smooth" });
    }
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      var target = chapters[i];
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + 1, behavior: reduced ? "auto" : "smooth" });
      var h = $("h2", target);
      var done = function () { h && h.focus({ preventScroll: true }); };
      if ("onscrollend" in window && !reduced) window.addEventListener("scrollend", done, { once: true });
      else setTimeout(done, 50);
    });
  });

  /* ---------- The channel strip's pause button ---------- */
  var channels = $(".channels");
  var pauseBtn = $(".channels__pause");
  if (channels && pauseBtn) {
    pauseBtn.addEventListener("click", function () {
      var paused = !channels.classList.contains("is-paused");
      channels.classList.toggle("is-paused", paused);
      pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
      pauseBtn.setAttribute("aria-label", paused ? "Play the moving channel list" : "Pause the moving channel list");
      $("use", pauseBtn).setAttribute("href", paused ? "#i-play" : "#i-pause");
    });
  }

  /* ---------- Chapter 3: the blueprint grid ---------- */
  var bp = $(".ch-3 .blueprint");
  var crosses = [];
  function buildBlueprint() {
    if (!bp) return;
    var sec = bp.parentElement;
    var w = sec.clientWidth;
    var h = sec.clientHeight;
    var vw = L.vw;
    var cw = vw >= 1024 ? Math.min(1320, vw - 120) : vw >= 768 ? vw - 64 : vw - 40;
    var cols = vw >= 1024 ? 12 : vw >= 768 ? 8 : 4;
    var g = vw >= 768 ? 24 : 16;
    var colW = (cw - (cols - 1) * g) / cols;
    var left = (w - cw) / 2;
    var xs = [];
    for (var i = 0; i < cols; i++) {
      var x0 = left + i * (colW + g);
      xs.push(Math.round(x0) + 0.5, Math.round(x0 + colW) + 0.5);
    }
    var ys = [];
    for (var yy = 56; yy < h; yy += 112) ys.push(yy + 0.5);
    var out = [];
    xs.forEach(function (x) { out.push('<line class="bp-v" x1="' + x + '" y1="0" x2="' + x + '" y2="' + h + '"/>'); });
    ys.forEach(function (y) { out.push('<line class="bp-h" x1="0" y1="' + y + '" x2="' + w + '" y2="' + y + '"/>'); });
    crosses = [];
    xs.forEach(function (x) {
      ys.forEach(function (y) {
        crosses.push({ x: x, y: y });
        out.push('<g class="bp-cross"><line x1="' + (x - 4) + '" y1="' + y + '" x2="' + (x + 4) + '" y2="' + y + '"/><line x1="' + x + '" y1="' + (y - 4) + '" x2="' + x + '" y2="' + (y + 4) + '"/></g>');
      });
    });
    bp.setAttribute("viewBox", "0 0 " + w + " " + h);
    bp.innerHTML = out.join("");
    crossEls = $$(".bp-cross", bp);
  }
  var crossEls = [];
  if (bp && S.finePointer && !reduced) {
    var sec3 = bp.parentElement;
    var pending = null;
    sec3.addEventListener("mousemove", function (e) {
      var r = sec3.getBoundingClientRect();
      pending = { x: e.clientX - r.left, y: e.clientY - r.top };
      requestAnimationFrame(function () {
        if (!pending) return;
        crossEls.forEach(function (el, i) {
          var c = crosses[i];
          var d = Math.hypot(c.x - pending.x, c.y - pending.y);
          el.style.setProperty("--a", d < 120 ? "0.2" : "0.08");
        });
      });
    });
    sec3.addEventListener("mouseleave", function () {
      crossEls.forEach(function (el) { el.style.setProperty("--a", "0.08"); });
    });
  }

  /* ---------- Chapter 6: the week ruler ---------- */
  var ruler = $(".week-ruler");
  if (ruler) {
    var tag = $(".week-tag", ruler);
    var days = $$(".week-days button", ruler);
    var show = function (b) {
      var r = ruler.getBoundingClientRect();
      var br = b.getBoundingClientRect();
      tag.textContent = b.textContent + " · " + b.getAttribute("data-fig");
      tag.style.setProperty("--tx", br.left - r.left + br.width / 2 + "px");
      tag.classList.add("is-on");
      days.forEach(function (d) { d.classList.toggle("is-on", d === b); });
    };
    var hide = function () {
      tag.classList.remove("is-on");
      days.forEach(function (d) { d.classList.remove("is-on"); });
    };
    days.forEach(function (b, i) {
      b.addEventListener("mouseenter", function () { show(b); });
      b.addEventListener("focus", function () { show(b); });
      b.addEventListener("click", function () { show(b); });
      b.addEventListener("mouseleave", hide);
      b.addEventListener("blur", hide);
      b.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          days[clamp(i + (e.key === "ArrowRight" ? 1 : -1), 0, days.length - 1)].focus();
        }
      });
    });
  }

  /* ---------- Chapter 8: the tags lean away from the pointer ---------- */
  var ch8 = $(".ch-8");
  if (ch8 && S.finePointer && !reduced) {
    var ftags = $$(".float-tag", ch8);
    ch8.addEventListener("mousemove", function (e) {
      ftags.forEach(function (tg) {
        var r = tg.getBoundingClientRect();
        var dx = r.left + r.width / 2 - e.clientX;
        var dy2 = r.top + r.height / 2 - e.clientY;
        var d = Math.hypot(dx, dy2) || 1;
        var k = clamp(1 - d / 260, 0, 1) * 8;
        tg.style.setProperty("--px", ((dx / d) * k).toFixed(1) + "px");
        tg.style.setProperty("--py", ((dy2 / d) * k).toFixed(1) + "px");
      });
    });
    ch8.addEventListener("mouseleave", function () {
      ftags.forEach(function (tg) {
        tg.style.setProperty("--px", "0px");
        tg.style.setProperty("--py", "0px");
      });
    });
  }

  /* ---------- Chapter 9: the answer types in, the question rides the ribbon ---------- */
  var ch9 = $(".ch-9 .chapter__grid");
  if (ch9) {
    var typeEls = $$(".type", ch9);
    var finalTexts = typeEls.map(function (el) { return el.getAttribute("data-type"); });
    var tp = $(".ribbon textPath", ch9);
    var path = $("#ribbon-path");
    var settleRibbon = function (animate) {
      if (!tp || !path || !tp.getComputedTextLength) return;
      var Lp = path.getTotalLength();
      var Tl = tp.getComputedTextLength();
      var end = Math.max(0, Lp - Tl - 24);
      if (!animate) {
        tp.setAttribute("startOffset", end);
        return;
      }
      var t0 = performance.now();
      var step = function (now) {
        var k = clamp((now - t0) / 1600, 0, 1);
        var e = 1 - Math.pow(1 - k, 3);
        tp.setAttribute("startOffset", (end - 120 + 120 * e).toFixed(1));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (reduced) {
      settleRibbon(false);
    } else {
      typeEls.forEach(function (el) { el.textContent = ""; });
      if (tp) tp.setAttribute("startOffset", "-400");
      ch9.addEventListener("speed:in", function () {
        var delay = 900;
        typeEls.forEach(function (el, i) {
          var full = finalTexts[i];
          setTimeout(function () {
            var n = 0;
            var tick = setInterval(function () {
              n++;
              el.textContent = full.slice(0, n);
              if (n >= full.length) clearInterval(tick);
            }, 40);
          }, delay);
          delay += full.length * 40 + 250;
        });
        setTimeout(function () { settleRibbon(true); }, 600);
      });
    }
    S.onResize(function () { settleRibbon(false); });
  }

  /* ---------- Pointer tilt on the phones (desktop only) ---------- */
  if (S.finePointer && !reduced) {
    $$("[data-tilt]").forEach(function (fig) {
      var target = $(".tilt-target", fig);
      var max = fig.closest(".ch-9") ? 2 : 3;
      fig.addEventListener("mousemove", function (e) {
        var r = fig.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        target.style.setProperty("--rx", (-py * max * 2).toFixed(2) + "deg");
        target.style.setProperty("--ry", (px * max * 2).toFixed(2) + "deg");
      });
      fig.addEventListener("mouseleave", function () {
        target.style.setProperty("--rx", "0deg");
        target.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Chapter 10: the swatches work ---------- */
  var sw = $(".scene-swatch");
  if (sw) {
    var btns = $$(".sw-card button", sw);
    var sweeping = null;
    var pick = function (b, focus) {
      btns.forEach(function (x) {
        x.setAttribute("aria-checked", x === b ? "true" : "false");
        x.tabIndex = x === b ? 0 : -1;
      });
      sw.style.setProperty("--brand", b.getAttribute("data-c"));
      sw.style.setProperty("--brand-t", b.getAttribute("data-t"));
      if (focus) b.focus();
    };
    btns.forEach(function (b, i) {
      b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1;
      b.addEventListener("click", function () {
        clearInterval(sweeping);
        pick(b, false);
      });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        clearInterval(sweeping);
        pick(btns[(i + d + btns.length) % btns.length], true);
      });
    });
    if (!reduced) {
      pick(btns[0], false);
      sw.closest(".chapter__grid").addEventListener("speed:in", function () {
        var n = 0;
        setTimeout(function () {
          sweeping = setInterval(function () {
            n++;
            pick(btns[n], false);
            if (n >= btns.length - 1) clearInterval(sweeping);
          }, 300);
        }, 700);
      });
    }
  }

  /* ---------- Chapter 10: the scattered strokes drift with the mouse ---------- */
  var scatter = $$(".ch-10 .scatter");
  if (scatter.length && S.finePointer && !reduced) {
    $(".ch-10").addEventListener("mousemove", function (e) {
      var nx = e.clientX / window.innerWidth - 0.5;
      var ny = e.clientY / window.innerHeight - 0.5;
      scatter.forEach(function (el, i) {
        var k = 8 + i * 2;
        el.style.setProperty("--mx", (nx * k).toFixed(1) + "px");
        el.style.setProperty("--my", (ny * k).toFixed(1) + "px");
      });
    });
  }

  measure();
  S.onResize(measure);
  window.addEventListener("load", function () {
    measure();
    S.refresh();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); S.refresh(); });
})();
