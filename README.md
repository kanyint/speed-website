# speed. website

The marketing site, built from *Speed Website Copy v4.1* (October 2026). It's plain HTML, CSS and JS with no build step, so it stays inside the copy deck's performance budget.

Done so far: the **home page**: the opening, the hero with its logo strip, the feature highlights (eight areas, after beside.com and calendly.com: the texts scroll past one pinned picture stage whose loops crossfade to match; on phones each picture sits under its text), the speed. AI section (after Revolut's AIR section: a centred headline, line and white button, with a dark desktop speed. AI window rising from the bottom edge and playing three scenes in turn; the page dims from daylight to a near-black mesh with grey glows as it arrives), and the shared ending, which opens with "Grow with speed. Literally." as a scroll-driven flow after giga.ai's "Turn every conversation into a better agent" (the example month's sales flow in as fine strands, split into what the month costs, and what is left becomes the profit; about ₦60,000 a strand; the full table stays in the page for screen readers). After it, "Switch easily, make it yours." has its own dark section after deel.com's "One modern experience": three cards from the deck's Set-up chapter that take turns by themselves, and a wide photograph for each card (in `assets/img/switch/`, cross-fading as the cards turn) with the product floating on it (Move-in Day, rules and roles, brand and alerts; one card at a time on phones). The earlier ten-chapter version with the light journey is kept in `archive/2026-10-20-chapters/`.

## Run it

```bash
python3 tools/serve.py         # from the repository root, then open http://localhost:8765
```

The stylesheets and scripts are linked with a version tag (`?v=20261021`). When you change one, bump the tag in `index.html` so browsers that kept an older copy fetch the new one. `tools/serve.py` also tells browsers not to keep files while you preview.

Use `tools/serve.py` rather than `python3 -m http.server`. The built-in server can't answer the range requests Safari needs to play video, so the feature cards would sit still there.

Links use the deck's site map (`/product/finance`, `/plan` and so on). They only resolve once those pages exist. `vercel.json` turns on clean URLs for deploys.

## How the references stay consistent

Every page borrows structure and motion from a different reference site, but the look itself comes from one shared system:

| File | What it holds | Who uses it |
|---|---|---|
| `assets/css/tokens.css` | Every colour, type size, space, radius, shadow, glass recipe and motion value from the deck's "Tokens for the builder" table, plus the `data-tone` surfaces (dark / light / volt) | Every page |
| `assets/css/components.css` | The one button and its caption, text links, icon discs, glass chips, picture frames, the top bar and both menus, the phone menu, entrances | Every page |
| `assets/css/ending.css` | The ending: the example month's flow, switching, Choose your plan (hidden on the home page for now; remove `hidden` from `#plan-summary` to bring it back), Questions and the footer | Every page |
| `assets/css/home.css` | Only what is unique to the home page: the opening, hero, channel strip and feature highlights | Home |
| `assets/js/site.js` | Shared behaviour (top bar, menus, questions, the example month's flow, footer) | Every page |
| `assets/js/home.js` | The hero's darkening, the pinned picture stage and its loops, the feature tabs and points | Home |

A new page should add one page stylesheet and script. It should never add colours, sizes or components of its own. If it needs a new value, that value goes into `tokens.css` first. Each section declares `data-tone`, and its text, discs, button colour and focus ring follow automatically.

## Icons, wordmark and strokes

`tools/build-sprite.py` builds the inline SVG sprite in each page. The sprite holds:

- the wordmark letters, taken from `Logos/Logo-Pri.svg`, with the volt full stop added
- the three strokes, drawn to the brand kit: parallel, rounded, at 32°
- the Lucide icons, pinned to 0.460.0
- the channel and social glyphs

To add an icon, add its name to `ICONS` and run:

```bash
python3 tools/build-sprite.py
```

## Placeholders and open items

- **Hero photo.** In place at `assets/img/hero/`: `hero-owner-1536.webp` for desktop (124 KB) and `hero-owner-phone-960.webp` for phones and tablets (118 KB, a crop of her face and shoulders), both inside the deck's limits. The source was 1536 px wide, so a 2880 px version for sharp retina desktops still needs a larger original.
- **Photos.** Every other photo slot is an art-directed stand-in with a small "Photo to come" tag, waiting for the generated pictures. To hide the tags for a review, add `data-hide-ph-tags` to `<html>`. The feature section's picture cards are built as live HTML; their figures are examples and the section says so.
- **Top bar menus.** Structured after harvey.ai inside our floating card: Product, Use cases and Company each open the one card, which resizes as you move between them, with the links on the left and a featured card on the right (speed. AI, use case 01, the Company page). The Company menu links to sections of the Company page by anchor: `#what-we-believe`, `#how-we-work`, `#where-we-are`, `#how-money-moves` and the deck's `#talk-to-us`. Give those sections these ids when the page is built.
- **WhatsApp and phone number.** Hidden until the real number exists, as the deck requires. Email shows in their place. Add `data-whatsapp-live` to `<html>` to switch them on.
- **Social profiles and store links.** These point to `#` until the profiles and listings exist. The store pills need the official App Store and Google Play badge artwork.
- **Sharing image.** `og:image` is left out until `/og/home.jpg` exists (the hero woman photo, 1200 × 630).
- **Cookie notice and analytics.** Not built yet. Click events collect in `window.speedEvents` and are never sent anywhere.
