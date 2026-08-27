/* ============================================================
   Speed — marketing site interactions
   - Lenis smooth scrolling (native fallback if CDN unavailable)
   - IntersectionObserver reveals (+ staggered children)
   - Parallax layers, scroll progress, nav shrink
   - Animated counters, subtle tilt on the dashboard mock
   ============================================================ */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- smooth scrolling ---------- */
let lenis = null;

if (!prefersReducedMotion && typeof window.Lenis === "function") {
  lenis = new window.Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
  });
  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  window.lenis = lenis;
} else {
  // no library (offline) or reduced motion: browser-native smooth anchors
  document.documentElement.classList.add("native-scroll");
}

// anchor navigation
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) {
      lenis.scrollTo(el, { offset: -72 });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
    }
    history.pushState(null, "", id);
  });
});

/* ---------- hero entrance ---------- */
window.addEventListener("load", () => {
  requestAnimationFrame(() => document.body.classList.add("is-loaded"));
});
// fallback in case load hangs on slow assets
setTimeout(() => document.body.classList.add("is-loaded"), 900);

/* ---------- scroll reveals ---------- */
(() => {
  document.querySelectorAll(".stagger").forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty("--i", i));
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll(".reveal, .stagger").forEach((t) => io.observe(t));

  // mocks with internal animations (sparkline, meter, chart bars)
  const ioMock = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          ioMock.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  document.querySelectorAll(".mock, .dash").forEach((m) => ioMock.observe(m));
})();

/* ---------- animated counters ---------- */
(() => {
  const els = document.querySelectorAll("[data-count]");
  const fmt = (n) => n.toLocaleString("en-US");

  const animate = (el) => {
    const end = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || "";
    const dur = 1600;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + fmt(Math.round(end * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  els.forEach((el) => io.observe(el));
})();

/* ---------- nav shrink + scroll progress + parallax ---------- */
(() => {
  const nav = document.getElementById("nav");
  const bar = document.getElementById("progressBar");
  const parallaxEls = [...document.querySelectorAll("[data-parallax]")];

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 24);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    if (!prefersReducedMotion) {
      parallaxEls.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax);
        el.style.transform = `translateY(${y * speed}px)`;
      });
    }
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  if (lenis) lenis.on("scroll", onScroll);
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
})();

/* ---------- subtle 3D tilt on the dashboard mock ---------- */
(() => {
  if (prefersReducedMotion) return;
  const el = document.querySelector("[data-tilt]");
  if (!el || !window.matchMedia("(pointer: fine)").matches) return;

  const strength = 4; // degrees
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${-py * strength}deg) rotateY(${px * strength}deg)`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
  });
})();
