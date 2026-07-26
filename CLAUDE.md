# Project Brief: Plainsight — Chart Accessibility Pattern Reference

## Status
In progress. This document is the output of an ideation/planning conversation and is
meant to hand off full context to whoever (human or Claude Code) builds v1. Built so
far: Stacked Bar Chart and Double Bar Graph (both v1 chart pages, full pattern
implementation). Remaining v1 chart types (Donut/Pie, Multi-Series Line, Likert Scale)
and all cross-cutting pattern pages are still stubs.

## Mission
A library-agnostic reference site documenting expected keyboard operation and screen
reader/assistive-technology behavior for common chart types — a sibling project to
[native-form-elements](https://formspiel.github.io/native-form-elements/), same spirit
applied to data visualization instead of form controls.

**Core thesis** (use this near-verbatim as homepage intro copy): A chart's entire value
proposition is letting a sighted user spot a trend, an outlier, a comparison, in under a
second — a perceptual shortcut a table doesn't give you. If the "accessible version" of
a chart is just a data table fallback, AT and keyboard users get a strictly worse
experience: same data, none of the perceptual shortcut. The goal of this project is
charts that ARE the accessible experience, with a data table as a genuine parallel
option for users who want exact values — not an excuse for skipping chart accessibility.

## Audience
Primary: the author's team of accessibility testers/auditors at a large enterprise (not
named in public materials). They use it as a checklist companion during audits of
applications containing charts. Secondary, via the testers: developers building charts
and designers who need to understand accessible chart design before creating
inaccessible ones by default.

Single source of truth for all three audiences — no separate content tracks. Testers use
it directly; they share links/sections with dev and design as needed. Keep maintenance
light: one canonical "Getting Started" area, not three parallel paths.

## Scope discipline
- Library-agnostic: patterns apply regardless of implementation (Highcharts, D3,
  Chart.js, ECharts, custom, etc.) — link to libraries but don't audit them yet (see
  Backlog).
- Modern evergreen browsers only: Chrome, Edge, Firefox, Safari + mobile equivalents.
- Real-world density in demos: **~30 data points**, not toy examples with 3-4 points.
  Toy examples make every pattern look easier than it is; 30 points forces real
  decisions (SR navigation chunking, label collision at small viewports, reflow).
- Good-pattern-only live demos. No deliberately-broken "bad" demo variants — cover bad
  patterns in prose/checklists instead. Keeps tone constructive and demos low-maintenance.

## Information architecture
```
Home
  — short pitch (not heavy-handed — "convincing by quality") + full index below
  — full-length version of the "why not just a table" thesis lives here;
    chart pages get a one-paragraph callback + link back, not the full essay
Getting Started (single canonical path, testers share onward as needed)
Per chart type (see Chart Scope below) — template per page:
  - When to use it / when it's the wrong choice
  - Interaction complexity tier: Summary vs Exploratory
  - Expected accessibility tree (role, accessible name source, description source)
  - Keyboard pattern (table: key → expected behavior)
  - Screen reader behavior (what's announced, verified SR × browser matrix)
  - Data table fallback (live demo, sortable) + CSV download
  - Common failure patterns seen in audits (WCAG SC mapped) — team-sourced, see below
  - Mobile / touch equivalent
  - Library notes (plain links only for v1 — see Backlog)
Cross-cutting patterns (referenced from multiple chart pages):
  - Color & non-color encoding
  - Tooltips (keyboard-triggerable? persistent? role?)
  - Live/updating data (aria-live strategy)
  - Legends as interactive filters
  - Zoom/pan/drill-down
  - Navigation at scale (chunking strategy for dense charts, e.g. 30 points)
  - Reflow/zoom at small viewports (WCAG 1.4.10) — including honest "sometimes a chart
    is just too complex for 320px, here's the real blocker" cases, not just workarounds
  - Canvas vs SVG (see below — own page)
  - Motion (see Backlog — needs a decision pass once first demos exist)
  - Dual-axis / annotations / reference lines — placement (own page vs folded into
    specific chart pages) is NOT YET DECIDED, revisit once Multi-Series Line Chart
    demo exists (see Open Decisions)
Audit checklist (condensed/copyable, derived from chart pages, not authored fresh)
Verified against (SR × browser matrix, methodology, changelog — changelog deferred,
  see Backlog)
```

### Common failure patterns — sourcing
The "common failure patterns seen in audits" section per chart page should be
team-sourced over time: the team collects real patterns encountered during audits and
adds them. Keep this at the pattern level (name the behavior, don't build an exhaustive
annotated catalog) — a few representative failure modes per page, not a comprehensive
list.

### Canvas vs SVG (cross-cutting page)
- Canvas is a single opaque bitmap to the browser — nothing in it exists in the
  accessibility tree unless rebuilt manually (reference: Figma's "Mirror DOM" approach,
  https://www.figma.com/blog/building-accessibility-into-a-canvas-based-product/ — full
  synthetic accessibility tree, bidirectional focus/selection sync, coalesced live
  region announcements. Useful as a "gold standard, but here's what it actually costs"
  example, not a template to replicate for a chart).
- Spectrum of fixes, cheapest to most expensive: (1) canvas fallback content between
  `<canvas>` tags — weak, legacy mechanism only; (2) parallel synced DOM/SVG overlay
  exposing just interactive hotspots + accessible names — realistic middle ground for a
  chart; (3) full synthetic tree + bidirectional sync, Figma-style — rarely justified
  for a chart, but testers should recognize it when a vendor has actually done it.
- Explicitly flag: this project's own demos are SVG, but most chart libraries in the
  wild (Chart.js, Highcharts) default to canvas rendering. SVG-in-our-demos ≠ "SVG is
  the requirement" — the requirement is correct a11y tree/keyboard/AT behavior,
  achievable via either, just harder via canvas.

## Chart scope

### v1 (5 chart types)
Selected for coverage of genuinely distinct accessibility problems, not popularity
alone, and ordered to build shared understanding progressively:

1. **Stacked Bar Chart** — build FIRST. Foundational additive-stacking pattern; baseline
   that Likert (below) extends.
2. **Double Bar Graph** — diverging/mirrored-axis bars (values either side of a center
   line, not edge-anchored).
3. **Donut / Pie Chart** — part-to-whole, angle encoding. Also the natural home for a
   "should this even be a chart?" teaching moment — bar charts often communicate the
   same data more accessibly than pie/donut.
4. **Multi-Series Line Chart** — trend over time, multiple series. Natural home for
   exploring dual-axis / annotation questions (see Open Decisions).
5. **Likert Scale Chart** — diverging STACKED variant of #1 (center-zero, not
   edge-zero). High relevance to the team's actual survey/UX audit work.

### Backlog (not v1, roughly ascending difficulty)
- Pareto Chart (combo: bars + cumulative % line, secondary axis)
- Progress Bar Chart
- Sentiment Trend Chart (combo: bars + overlaid trend line)
- CSAT Score Survey Chart
- Sunburst Chart (hierarchical, radial) — genuinely hard, needs dedicated research time
- Slope Chart (rank-change between two points, line-path tracking) — genuinely hard
- Sankey Chart (many-to-many flow) — genuinely hard, path-tracing is a poor fit for
  point-by-point keyboard navigation; needs real design thinking, not a template
  transplant from bar/line patterns

### Reference examples that shaped the "real-world density" requirement
Two real VO2max-test charts (sports science data) were used during planning to argue
for realistic, not toy, demo data:
- A scatter plot with two data clusters, each with an overlaid regression/trend line —
  illustrates that trend lines are *derived* data needing their own description ("group
  A shows a steeper response than group B"), not just an implied visual comparison.
- A dual-Y-axis multi-series line chart (different units per axis) with an annotated
  vertical threshold line and a circled intersection point — illustrates two open
  problems: (a) an AT user needs to know which axis a series belongs to, and (b) a
  visual callout like a circle or dashed line carries meaning that needs a text
  equivalent.

These aren't separate chart types to build — they're the argument for why dual-axis /
annotation handling needs real attention once the Multi-Series Line Chart page exists.

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Markup | Hand-written HTML5, no templating engine | Full control over ARIA on every element |
| Styling | CSS custom properties, one token layer | `prefers-color-scheme`, `prefers-contrast`/`forced-colors` for light/dark/high-contrast, matches native-form-elements |
| JS | Vanilla, no framework | No hydration/focus-management surprises |
| Chart geometry | Single shared `svg-helpers.js` | Linear/band scales, path-string builders: hand-roll (trivial, no edge cases worth outsourcing). Axis tick generation ("nice" round numbers): **vendor a single small MIT-licensed function** (credit D3/Bostock's `ticks()` algorithm) rather than reinvent — this is the one spot with real edge-case risk. Donut/pie arc-path trig: hand-roll (stable, well-documented math), test carefully against small-segment and single-dominant-segment edge cases. |
| Accessibility wiring | Hand-written per demo, NEVER abstracted into the helper | The point of the site is that testers can read the exact ARIA/keyboard code — abstracting it away defeats the purpose |
| Build step | None | Zero-friction contribution, long-term durability, no bundler mangling ARIA wiring |
| Fonts | System font stack | No external font loading, keeps "no build tools" honest |
| CI accessibility checks | **Pa11y CI**, errors-only, from v1 | Plain-English output over axe's more technical reporting; post results as PR comment; keep signal high (errors only, not warnings) so nobody starts ignoring it |
| Production hosting | GitHub Pages | Same as native-form-elements |
| Preview/staging | **Cloudflare Pages**, automatic PR preview URLs | Test on Windows/macOS/mobile before merging to main; zero config for a static-only site; chosen over Netlify for free-tier generosity and fewer login/usage nags |
| Commit convention | Conventional Commits (`feat:`, `fix:`, `chore:`, etc.), documented in `CONTRIBUTING.md` | Enables filtered changelog generation later (see Backlog); must apply to human and AI-assisted commits alike or the filter has nothing reliable to key off |

## Naming — DECIDED: Plainsight
"Hidden in plain sight," inverted: accessible charts should be obvious, not hidden.
Ties back to the "augenmerk"/attention concept from ideation, in English, without
referencing the employer.

Note: the name is already in use elsewhere on GitHub (a steganography tool at
`rw/plainsight`, and more notably **PlainsightAI**, an unrelated computer-vision
company with an active GitHub org). No technical collision for a repo under the
author's own account (e.g. `formspiel/plainsight` — GitHub namespaces by owner), but
worth being aware of if the project ever gains a custom domain or public visibility,
since search results may surface the unrelated company. Accepted as a conscious
tradeoff, not revisited unless it becomes an actual problem.

Other candidates considered, not used: Focal, Vantage, Datamark, Plainchart, Legible,
Clearcut, Keynote (ruled out — conflicts with an existing product name).

## Backlog items (already drafted as standalone GitHub issue files)
1. **Library accessibility audits** — deferred because auditing a library properly
   (AT support level, known gaps, workarounds) takes real time per library and would
   slow down shipping the core pattern reference. Patterns first. Issue drafted with
   candidate library list (Highcharts, Chart.js, D3, ECharts, Recharts, Nivo) and
   definition of done (verdict-style entries replacing/joining plain links).
2. **Motion / reduced-motion decision** — entrance animation (bars growing up from
   the baseline, staggered left-to-right) now implemented on both the Stacked Bar
   Chart and Double Bar Graph as the real demos to decide this against, per the plan
   below: allowed normally, suppressed entirely under `prefers-reduced-motion`
   (confirmed straightforward in practice — one
   `@media (prefers-reduced-motion: no-preference)` block wrapping the `@keyframes`
   rule). The animation is purely visual (the hotspot overlay is positioned
   independently and is immediately interactive/correct regardless of whether the
   animation is playing). Two toggles now exist on each chart with different
   answers to the "value changed" question: the **pattern toggle** (fill patterns
   on/off) is a pure CSS class swap with no animation either way, so reduced-motion
   users see the same instant change as everyone else — nothing to suppress, nothing
   missing. The **legend toggle** (hide/show a series) rebuilds the bars via the same
   animated-entrance path, which IS suppressed under reduced motion with no
   substitute cue yet — still deferred: whether that rebuild needs a distinct
   non-animated "this changed" indicator under reduced motion so sighted
   reduced-motion users don't miss a series appearing/disappearing.
3. **Changelog generation from git history** — deferred until there's meaningful
   (post-beta-churn) history to generate from. Confirmed feasible: Conventional Commits
   + a generator like `git-cliff` or `release-please` can filter to `feat`/`fix` only,
   excluding `chore`/`refactor`/`style` automatically — this is config, not custom
   code, contingent on commit message discipline (see Tech Stack).
4. **Dual-axis / annotations / reference lines: own cross-cutting page vs. folded into
   specific chart pages** — explicitly undecided, revisit once the Multi-Series Line
   Chart (v1 #4) demo exists.

## Verified SR × browser matrix (template — fill in per chart page)
Primary/most important: JAWS + Edge, NVDA + Edge. Also cover: VoiceOver macOS, VoiceOver
iOS (mobile is a priority). Firefox is NOT available in the author's working
environment but is still considered important — mark as "not tested in our environment"
honestly rather than omitting Firefox from the matrix.

## Open decisions carried forward (not blocking v1 start)
- Cross-cutting page placement for dual-axis/annotations (see Backlog #4)
- Motion nuance beyond the basic reduced-motion default (see Backlog #2)
- Exact "Getting Started" copy/framing (single source confirmed, wording not drafted)
