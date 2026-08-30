# VivoFlow Signal Lab UI QA

## Comparison target

- Source visual truth: `C:/Users/opsad/AppData/Local/Temp/codex-clipboard-74bc1f39-2171-4fab-a566-a0a5e1555d7d.png` (268 × 138 px) and `C:/Users/opsad/AppData/Local/Temp/codex-clipboard-ca8273e2-1e82-427a-8702-a9778c98419c.png` (282 × 320 px)
- Implementation captures: `D:/code1/VivoFlow/design-qa-followup-dashboard.png` (1265 × 712 px), `D:/code1/VivoFlow/design-qa-followup-settings.png` (1265 × 712 px), `D:/code1/VivoFlow/design-qa-followup-background.png` (1265 × 712 px), `D:/code1/VivoFlow/design-qa-graphite-dashboard.png` (1265 × 712 px), and `D:/code1/VivoFlow/design-qa-graphite-theme.png` (1265 × 712 px)
- Responsive implementation capture: `D:/code1/VivoFlow/design-qa-followup-mobile.png` (375 × 812 px)
- Route: `http://localhost:4173/` → Dashboard and Settings → Appearance
- State: connected collector, Signal Lab/Amicro style, dark mode, background preset list visible; live data is intentionally dynamic
- Desktop CSS viewport: 1280 × 720, effective screenshot 1265 × 712, device scale factor 1
- Mobile CSS viewport: 390 × 844, effective screenshot 375 × 812, device scale factor 1
- Density normalization: source screenshots and browser captures are 1×; browser scrollbar reduces effective capture width and is recorded above

## Full-view comparison evidence

The attached card reference shows a visible extra top layer; the dashboard capture shows the corresponding KPI cards with no generated `::before` layer and a single elevation shadow. The attached settings reference shows a wide rail-to-panel gap; the desktop settings capture measures a 12px gap. The background capture shows five presets plus a custom HEX field, while the graphite captures show the selected `#17202a` background carried through the panel/card surfaces and border system instead of leaving the fixed teal-green tokens in place.

## Focused-region comparison evidence

- Header/navigation: the `CONTROL ROOM` header and indexed module rail establish hierarchy while keeping the same settings entry point and module labels.
- Card surface: `.vf-kpi::before` computes to `content: none`; the current box shadow is a single surface shadow without the previous inset highlight.
- Settings layout: `.settings-layout` uses a 9rem rail and 0.75rem grid gap; measured nav-to-panel gap is 12px at the desktop viewport.
- Background controls: the Appearance tab renders six background options (five presets plus custom) and a `背景色值` HEX field with a signal preview; both the `深海蓝` preset and a custom `#123f48` value round-trip through the restarted backend.
- Graphite theme linkage: with `石墨灰` selected, `--vf-card`, `--vf-line`, `--vf-line-strong`, `--surface-bg`, and `--surface-border-color` all resolve from `#17202a`; KPI and panel screenshots show neutral graphite-blue-gray surfaces and borders.
- Mobile navigation: at 390 × 844, the rail becomes a horizontal pill track, the background grid becomes three columns, and the fixed bottom navigation exposes `概览` and `设置` without horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: Outfit remains the display/data face and Noto Sans SC remains the CJK fallback. The redesign adds a restrained monospace eyebrow/meta treatment for telemetry context and preserves readable Chinese labels.
- Spacing and layout rhythm: desktop uses a compact 9rem navigation rail plus a flexible content panel with a 0.75rem grid gap; mobile collapses to a horizontal rail, 1rem content padding, and a safe-area-aware bottom dock.
- Colors and visual tokens: the Amicro baseline now uses a cool graphite canvas, off-white surfaces, teal signal state, and amber waiting state. Active controls retain primary-theme contrast and focus rings.
- Image quality and asset fidelity: no new non-standard raster imagery is introduced; existing chart, album, audio, and icon assets remain the source of truth. The redesign uses the existing Lucide icon system rather than drawing replacement marks.
- Copy and content: existing localized labels and control semantics are preserved; background preset labels and `overview` were added for the new appearance and mobile navigation controls.

## Findings

No actionable P0, P1, or P2 findings remain.

### Comparison history

1. First mobile review exposed low contrast on the active settings pill and an unnecessary nested scroll inside the style selector. Fixed by using a tinted signal-color active pill and allowing the style grid to use the page scroll.
2. Post-fix mobile capture at 390 × 844 confirms visible active navigation, no horizontal overflow, and persistent bottom navigation.
3. Follow-up request review found the extra card top layer and oversized settings gap; removed the Amicro pseudo-layer and inset highlight, tightened the grid to a measured 12px gap, and added background presets plus custom HEX input. Post-fix desktop and mobile captures show no actionable P0/P1/P2 mismatch.
4. Restarted the release backend with the new schema and verified preset plus custom HEX persistence after reload; restored the default `#0b1a20` signal palette.
5. The graphite follow-up found static `--vf-card`, `--vf-line`, `--muted`, `--input`, and primary-mixed card borders; replaced them with background-derived Amicro tokens, preserved teal for live signal/active states, and re-captured the dashboard and Appearance background section. No actionable P0/P1/P2 mismatch remains.

## Implementation checklist

- [x] Refresh application header and connection status treatment.
- [x] Redesign settings information architecture and module navigation.
- [x] Add mobile rail and bottom navigation states.
- [x] Preserve collection, audio, album, appearance, and about interactions.
- [x] Verify desktop and mobile captures, card pseudo-layer, settings gap, background controls (including persistence), tab switching, and browser console errors.
- [x] `npm run build`
- [x] `cargo test -p vivoflow config::tests` (6 passed)
- [x] `git diff --check`
- [x] Verify graphite card/panel surfaces and border tokens in the running browser preview.

## 2D Models orientation follow-up

- [x] Added a dedicated landscape/portrait pair for each 2D scene. Landscape files are `1536 × 1024`; portrait files are `1024 × 1536`, with the scene-safe subject placement composed independently rather than cropped from the other orientation.
- [x] The home scene swaps image sources at the iPhone XS landscape breakpoint (`orientation: landscape` and `max-height: 520px`): portrait keeps the immersive vertical crop, while landscape uses the wide source with `object-fit: cover` and no portrait sidebars.
- [x] The landscape healing-room artwork contains its own rain treatment; the old portrait rain overlay is disabled in landscape so it cannot wash the wide scene in blue.
- [x] Source visual checks completed for all eight artwork files. The retained [landscape regression capture](D:/code/web/VivoFlow/design-qa-models2d-landscape.png) documents the old portrait-in-landscape failure; the new wide files are the replacement evidence set.
- [x] `npm run build`, `cargo test -p vivoflow`, and `git diff --check` pass after the orientation swap.

## Follow-up Polish

- P3: a future pass could add an optional compact dashboard summary header when live snapshot data is available.

final result: passed
