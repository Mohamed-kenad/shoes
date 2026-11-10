# LAST DEPT. — front-end study

A recreation of the **LAST DEPT.** footwear concept originally designed and built by
[Ascenta Studio](https://ascentastudio.com/last-dept/). This version is a framework-free,
strict-TypeScript [Vite](https://vite.dev/) app built around fast first paint, smooth media
transitions, and accessible interaction.

The storefront is one room: ten silhouettes on a lit wall, a short authored camera move into each
pair, a persistent bag, and a continuous mobile wall. There is no backend, no analytics, and no
framework runtime.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite 7 | Instant dev server, small ESM production output |
| Language | TypeScript 5.9, `strict` | Typed state, data and DOM boundaries |
| UI | Native DOM + CSS | The scene is mostly authored HTML; a framework would add runtime for little gain |
| Lint/format | Biome 2 | One fast tool for both |
| Tests | Vitest 5 | Unit tests for the pure logic |
| Media | WebP, H.264 MP4 | Small payloads and predictable decoding |
| Motion | CSS transitions + Web Animations API | GPU-friendly transform/opacity work |

There are **no production dependencies**. The built app is one HTML file, one CSS file, and one
JavaScript module.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # http://localhost:4173
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc --noEmit` then a minified Vite build |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | Biome check (lint + format rules) |
| `npm run format` | Biome format with writes |

## Experience

### Desktop wall

- Ten hotspots and ten shelf LEDs are authored against the 43:24 master artwork, so they stay
  aligned at every viewport width.
- Hovering or focusing a hotspot lights its shelf, loads its LED image on demand, and reveals the
  product label. Previewing a product also primes its camera clip and detail frame.
- The hotspots form a focusable grid. Arrow keys move between columns and rows; `Enter`/`Space`
  opens the product.
- The intro copy and wall are masked at the edges so the full-bleed scene blends into the page
  chrome.

### Product detail

- The camera move is an authored 0.45 s forward MP4 per product; leaving plays the reverse clip.
- Detail stills are chosen at 1376 px or 2752 px based on `devicePixelRatio × viewport`, then
  decoded before the overlay is revealed.
- A transition token invalidates stale moves if the visitor clicks another product or leaves
  mid-flight. `AbortController` cancels media waits.
- `Escape` and the Collection control leave the view. Focus returns to the hotspot that opened it.
- With reduced motion enabled, the still frame is shown directly and the video is skipped.

### Mobile collection

- A single continuous wall bitmap backs the 2 × 5 grid; cards only add text and a lightweight LED
  layer.
- Tapping a silhouette selects it, lights its shelf, and shows the dock. Tapping it again — or
  `View product` — opens the detail.
- Opening uses a FLIP-style flight from the card crop to the detail frame; closing flies back to
  the same card. The collection keeps its scroll position, so the visitor returns to the exact
  place they left.
- The mobile detail uses a single-column crop of the wall plus the LED layer, followed by the
  purchase panel, with a compact layout for short viewports.

### Bag and studio dialogs

- Native `<dialog>` elements handle modality, backdrop, and Escape automatically.
- Bag lines persist in `localStorage` under `last-dept.bag.v1`. Stored data is treated as
  untrusted: unknown products, stale sizes and malformed quantities are dropped on read.
- Quantity is capped at 99; the subtotal is derived from the catalogue, never from storage.
- Focus returns to the trigger when either dialog closes. The studio dialog includes the original
  project credit; checkout is intentionally unavailable.

## Architecture

```text
src/
  main.ts                  boot
  app.ts                   scene state machine + mobile/desktop choreography
  data/
    collection.ts          catalogue, hotspot geometry, label positions
  lib/
    bag-store.ts           validated, persisted bag state
    dom.ts                 tiny required<T>() / create() helpers
    flight.ts              desktop bag flight + mobile card/detail flight
    format.ts              price, size and count formatting
    media.ts               URLs, preloading, camera playback, decode helpers
    motion.ts              reduced-motion check, idle scheduler, WAAPI helper
  ui/
    wall.ts                hotspots, LEDs, labels, keyboard grid
    product-panel.ts       detail copy, sizes, add-to-bag state
    mobile-collection.ts   mobile grid, selection, dock
    bag-dialog.ts          bag rendering and line controls
    studio-dialog.ts       studio notes dialog
  styles/
    base.css               reset, tokens, fonts, global primitives
    layout.css             header, footer, wall, scene geometry
    product.css            detail overlay, purchase panel, add button
    mobile.css             mobile collection, detail and flight layers
    dialogs.css            bag and studio dialogs
    index.css              single CSS entry point
tests/
  format.test.ts
  bag-store.test.ts
public/
  fonts/                   Geist, Archivo (WOFF2)
  media/
    wall/                  1920/3200 wall still + texture
    mobile/                continuous mobile wall + LED overlay
    details/               per-product detail stills (1376/2752)
    thumbs/                bag thumbnails
    leds/                  per-shelf light strips
    videos/                forward/reverse camera moves
index.html                 semantic shell, preloads, dialog markup
```

### State model

Desktop product transitions move through `wall → outbound → detail → inbound → wall`. Mobile uses
`wall → detail → wall` with the flight overlay. `App` owns the transition token and the active
product; UI modules own only their slice of the DOM. All copy and prices come from
`data/collection.ts`, so the catalogue is the single source of truth.

## Performance notes

- **One scene bitmap per breakpoint.** Desktop preloads only the 1920/3200 wall; mobile preloads
  only the 1600 px continuous wall and its LED layer.
- **Media loaded on intent.** LEDs load on first hover/focus. Camera clips stay at
  `preload="none"` until a product is previewed or opened. Detail stills are decoded before use.
- **Small runtime.** Production output is roughly **9.2 kB gzip JS**, **6.1 kB gzip CSS**, and
  **3.1 kB gzip HTML**. There is no UI framework, router, state library, or analytics script.
- **Compositor-friendly motion.** Transitions use `transform` and `opacity`; flights use the Web
  Animations API and are removed when finished. `will-change` is limited to the elements that
  actually move.
- **Cheap rendering.** The wall video and detail stills are single composited layers. Mobile cards
  share one wall bitmap instead of loading ten separate images.
- **No layout thrash in hot paths.** Geometry is read once per transition; text is updated through
  `textContent`; lists are rebuilt only when the bag changes.
- **Explicit media delivery.** Fonts use `font-display: swap`; the wall and mobile wall are
  preloaded with media-scoped `<link rel="preload">` and high fetch priority.

For a production deployment, the detail stills are the largest remaining asset group and would be
the first candidates for AVIF plus responsive `srcset` served from a CDN.

## Accessibility

- Landmarks (`header`, `main`, `footer`, `nav`), a skip link, and a visible focus ring throughout.
- Hotspots expose product names; LEDs and labels are decorative and hidden from assistive tech.
- Arrow-key navigation across the wall grid, with focus-visible outlines.
- `aria-pressed` on mobile silhouettes, `aria-current` on the Collection link, and a polite status
  region for selection feedback.
- Native dialogs with labelled titles, Escape/backdrop close, focus restoration, and focusable
  controls.
- The desktop stage and mobile collection become `inert` while a product is open.
- `prefers-reduced-motion` removes camera playback, flights, and hover translation while keeping
  every function available.
- Colour pairs were chosen for readable contrast on the dark wall and cream dialogs.

## Testing and QA

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The 21 unit tests cover price/size/count formatting and bag persistence, including rejected
storage payloads, duplicate-line merging, half sizes, quantity limits and corrupt JSON. The
production build was manually checked with Playwright in Edge at **1440 × 900** and
**390 × 844 @ 2×** across the wall, hover, detail, added-to-bag, bag, studio, mobile selection,
mobile detail and mobile return flows, with zero console or page errors.

## Credits and rights

- **Original concept, art direction, imagery, video and store design:** Ascenta Studio —
  <https://ascentastudio.com/last-dept/>. This is an independent front-end study, not affiliated
  with or endorsed by Ascenta Studio.
- **Recreation and code:** this project.
- **Fonts:** Geist (Vercel) and Archivo (Omnibus-Type), both distributed under the SIL Open Font
  License.
- The photographs and camera clips remain the property of their original creator. They are included
  here to support a non-commercial study; do not redistribute them separately without permission.

## Limitations

- This is a concept storefront: products, prices, and checkout are demonstrations. There is no
  payment, inventory, or order backend.
- Bag state is local to the browser and can be cleared by the visitor at any time.
- No analytics, tracking, or third-party scripts are loaded.
