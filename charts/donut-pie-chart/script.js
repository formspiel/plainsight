/*
  Donut / Pie Chart demo.

  Same top-level idiom as the two bar charts (aria-hidden decorative SVG +
  a parallel layer of real, focusable hotspot elements carrying all
  accessibility semantics) -- see stacked-bar-chart/script.js for the
  fuller rationale. Hand-written separately, not shared, per this
  project's stance on chart accessibility code (see CLAUDE.md).

  What's genuinely different here, not just a re-skin of the bar charts:

  1. Angle, not position/length, is the visual encoding -- each hotspot
     needs to cover exactly one wedge-shaped hit area, not a rectangle.
     Rather than approximate that with an oversized rectangular button
     (which would overlap into neighboring thin slices) or a small
     centroid-only target (which would UNDERSIZE the hit area for big
     slices), each hotspot's clip-path is set to the exact same arc path
     used to draw its visible slice -- see buildHotspotLayer below.

  2. Because that clip-path hit area doesn't match the button's own
     rectangular box, the browser's native focus/hover outline (which
     always follows the box, not the clip shape) would draw a rectangle
     around the WHOLE chart on every hover/focus, not just the hovered
     slice. Suppressed on these hotspots specifically (see chart.css);
     replaced with a highlight synced onto the actual visible SVG slice
     instead (wireSegmentHighlight below) -- a real focus indicator, just
     driven from the invisible button's focus/hover state rather than
     drawn on the button itself.

  3. This is a single flat ring, not a hierarchy (no bar-summary-vs-
     segment split like the Stacked Bar Chart, no above/below-the-line
     split like the Double Bar Graph) -- Left/Right alone cover every
     stop, matching the Double Bar Graph's flatter keyboard model more
     than the Stacked Bar Chart's.

  4. Legend-driven hiding does NOT re-normalize the remaining slices to
     fill 360° the way the bar charts re-stack around a hidden series.
     A donut/pie's whole visual promise is "this circle is the whole" --
     re-filling it after removing a category would make the remaining
     slices silently claim a NEW, smaller whole, with no visual signal
     that anything changed. A reader glancing at a still-complete circle
     has no way to tell it no longer represents all 600 claims. Instead,
     every slice's angle is a fixed fact about the real, original total,
     computed once and never recomputed -- hiding a category just leaves
     a real, proportional gap where it was. See computeAllSlices and
     buildCenterLabel below, and "Legend as a filter" on this page.
*/

import { linearScale, donutArcPath } from "../../js/svg-helpers.js";
import { makeDetailsDismissible } from "../../js/details-dismiss.js";
import { donutData, seriesColors, TOTAL_CLAIMS } from "./data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEWBOX_SIZE = 500;
const CENTER = VIEWBOX_SIZE / 2;
const OUTER_RADIUS = 200;
const INNER_RADIUS = 115;
const LABEL_RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;
// Below this angular width a percentage label would overlap its neighbors
// or be too cramped to read -- none of this demo's six slices are
// actually this small, but the check stays in so a future edit to the
// data doesn't silently produce overlapping label text.
const MIN_LABEL_ANGLE = 0.22; // radians, ~12.6 degrees

const PATTERN_KINDS = ["diagonal", "dots", "crosshatch", "horizontal", "vertical", "grid"];

let hiddenKeys = new Set();

// Computed ONCE, from the full dataset, in data order, clockwise from 12
// o'clock (angle 0) -- every slice's angle is a fixed fact about the real
// total (TOTAL_CLAIMS), never recomputed when the legend hides a
// category. See the file header comment for why: unlike the bar charts'
// "re-stack," re-normalizing a part-to-whole ring after removing a slice
// would make the remaining slices silently claim a new, smaller whole.
function computeAllSlices() {
  let angle = 0;
  return donutData.map((d) => {
    const startAngle = angle;
    const sweep = (d.value / TOTAL_CLAIMS) * Math.PI * 2;
    angle += sweep;
    return { ...d, startAngle, endAngle: angle };
  });
}

const allSlices = computeAllSlices();

// The currently-visible subset of allSlices, in the same fixed order --
// this is what every render/keyboard-nav function below actually walks.
// Hiding a category removes it from this list (so its wedge and hotspot
// simply aren't drawn -- see buildSlices/populateHotspots) without
// touching any other slice's angle at all.
function visibleSlices() {
  return allSlices.filter((s) => !hiddenKeys.has(s.key));
}

let slices = visibleSlices();

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function buildPatternDefs() {
  const defs = svgEl("defs");
  const stroke = "var(--pattern-stroke)";

  const builders = {
    diagonal: () => svgEl("path", { d: "M0,8 L8,0", stroke, "stroke-width": 1.4 }),
    vertical: () => svgEl("line", { x1: 4, y1: 0, x2: 4, y2: 8, stroke, "stroke-width": 1.4 }),
    dots: () => svgEl("circle", { cx: 4, cy: 4, r: 1.5, fill: stroke }),
    crosshatch: () => svgEl("path", { d: "M0,8 L8,0 M0,0 L8,8", stroke, "stroke-width": 1.2 }),
    horizontal: () => svgEl("line", { x1: 0, y1: 4, x2: 8, y2: 4, stroke, "stroke-width": 1.4 }),
    // Sixth pattern, needed only because this chart has a sixth series --
    // horizontal + vertical together, distinct from crosshatch's diagonal
    // cross.
    grid: () => {
      const g = svgEl("g");
      g.append(
        svgEl("line", { x1: 0, y1: 4, x2: 8, y2: 4, stroke, "stroke-width": 1.1 }),
        svgEl("line", { x1: 4, y1: 0, x2: 4, y2: 8, stroke, "stroke-width": 1.1 })
      );
      return g;
    },
  };

  PATTERN_KINDS.forEach((kind, i) => {
    const pattern = svgEl("pattern", {
      id: `donut-pattern-${i + 1}`,
      width: 8,
      height: 8,
      patternUnits: "userSpaceOnUse",
    });
    pattern.append(builders[kind]());
    defs.append(pattern);
  });

  return defs;
}

function midpoint(radius, angle) {
  return [CENTER + radius * Math.sin(angle), CENTER - radius * Math.cos(angle)];
}

function buildSlices() {
  const group = svgEl("g", { class: "chart-slices" });

  slices.forEach((slice, i) => {
    const colorIndex = seriesColors[slice.key];
    const d = donutArcPath({
      cx: CENTER,
      cy: CENTER,
      innerRadius: INNER_RADIUS,
      outerRadius: OUTER_RADIUS,
      startAngle: slice.startAngle,
      endAngle: slice.endAngle,
    });

    // Staggered entrance, like the bar charts' bars -- transform-box:
    // fill-box with a scale-from-center keeps this purely visual, same
    // suppression under prefers-reduced-motion (see chart.css). Grouped
    // per slice (fill + pattern together) so both scale as one unit.
    const sliceGroup = svgEl("g", {
      class: "chart-slice-group",
      style: `animation-delay: ${i * 40}ms`,
    });

    const fill = svgEl("path", {
      d,
      class: "chart-donut-slice",
      "data-slice-key": slice.key,
      fill: `var(--series-${colorIndex})`,
    });
    const pattern = svgEl("path", {
      d,
      fill: `url(#donut-pattern-${colorIndex})`,
      class: "segment-pattern",
    });
    sliceGroup.append(fill, pattern);
    group.append(sliceGroup);

    // Percentage label, sighted-only decoration (the hotspot's own
    // accessible name is where the real value lives) -- skipped below
    // MIN_LABEL_ANGLE so a very thin slice doesn't get illegible,
    // overlapping text.
    const sweep = slice.endAngle - slice.startAngle;
    if (sweep >= MIN_LABEL_ANGLE) {
      const pct = Math.round((slice.value / TOTAL_CLAIMS) * 100);
      const mid = slice.startAngle + sweep / 2;
      const [lx, ly] = midpoint(LABEL_RADIUS, mid);
      const label = svgEl("text", {
        x: lx,
        y: ly + 4,
        class: "chart-donut-label",
        "text-anchor": "middle",
        "aria-hidden": "true",
      });
      label.textContent = `${pct}%`;
      group.append(label);
    }
  });

  return group;
}

function buildCenterLabel() {
  const group = svgEl("g", { class: "chart-donut-center", "aria-hidden": "true" });
  const visibleTotal = slices.reduce((sum, s) => sum + s.value, 0);
  const isPartial = visibleTotal !== TOTAL_CLAIMS;

  const totalText = svgEl("text", {
    x: CENTER,
    y: CENTER - 6,
    class: "chart-donut-center__total",
    "text-anchor": "middle",
  });
  totalText.textContent = String(visibleTotal);

  const labelText = svgEl("text", {
    x: CENTER,
    y: CENTER + 18,
    class: "chart-donut-center__label",
    "text-anchor": "middle",
  });
  // "of 600 shown" once something's hidden, not a silent "548 total
  // claims" -- the number in the middle of an otherwise-normal-looking
  // ring needs to say out loud that it's a subset, not the real total,
  // or it reads as just as authoritative as when nothing's hidden.
  labelText.textContent = isPartial ? `of ${TOTAL_CLAIMS} shown` : "total claims";

  group.append(totalText, labelText);
  return group;
}

function renderChart(container) {
  const svg = svgEl("svg", {
    viewBox: `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`,
    class: "chart-svg",
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.append(buildPatternDefs(), buildSlices(), buildCenterLabel());
  container.append(svg);
  return svg;
}

// Called after a legend toggle changes `slices` -- replaces the slices AND
// the center label (its total changes too), leaving only <defs> untouched.
function updateChart(svg) {
  svg.querySelector(".chart-slices").replaceWith(buildSlices());
  svg.querySelector(".chart-donut-center").replaceWith(buildCenterLabel());
}

// ---------------------------------------------------------------------
// Accessible hotspot overlay -- one stop per visible slice. Unlike the bar
// charts, each hotspot's hit area is clipped to its own wedge (see the
// file header comment) rather than positioned as a plain rectangle.
// ---------------------------------------------------------------------

function sliceDescription(slice) {
  const pct = Math.round((slice.value / TOTAL_CLAIMS) * 100);
  return `${slice.name}: ${slice.value} claims, ${pct}% of ${TOTAL_CLAIMS} total claims.`;
}

function buildHotspot(slice) {
  const d = donutArcPath({
    cx: CENTER,
    cy: CENTER,
    innerRadius: INNER_RADIUS,
    outerRadius: OUTER_RADIUS,
    startAngle: slice.startAngle,
    endAngle: slice.endAngle,
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hotspot hotspot--donut";
  button.dataset.sliceKey = slice.key;
  button.dataset.tooltip = sliceDescription(slice);
  button.tabIndex = -1;
  // The button's own box covers the full chart (see .hotspot--donut in
  // chart.css); clip-path is what actually restricts its visible AND
  // clickable area to this one wedge. Reuses the exact same path string
  // the visible slice itself is drawn with, so the hit area and the
  // visual shape can never drift apart.
  button.style.clipPath = `path("${d}")`;

  const label = document.createElement("span");
  label.className = "visually-hidden";
  label.textContent = sliceDescription(slice);
  button.append(label);

  return button;
}

function buildHotspotLayer(container) {
  const layer = document.createElement("div");
  layer.className = "chart-hotspots chart-hotspots--donut";
  layer.setAttribute("role", "group");
  layer.setAttribute("aria-labelledby", "donut-title");
  layer.setAttribute("aria-describedby", "donut-instructions");

  container.append(layer);
  populateHotspots(layer);
  return layer;
}

function populateHotspots(layer) {
  layer.innerHTML = "";
  slices.forEach((slice) => layer.append(buildHotspot(slice)));
}

function findHotspot(layer, key) {
  return layer.querySelector(`.hotspot[data-slice-key="${key}"]`);
}

function wireKeyboardNav(layer) {
  let current = layer.querySelector(".hotspot");
  current.tabIndex = 0;

  function moveTo(key) {
    const next = findHotspot(layer, key);
    if (!next) return;
    current.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
    current = next;
  }

  function currentIndex() {
    return slices.findIndex((s) => s.key === current.dataset.sliceKey);
  }

  layer.addEventListener("keydown", (event) => {
    const index = currentIndex();

    switch (event.key) {
      case "ArrowRight":
        if (index < slices.length - 1) moveTo(slices[index + 1].key);
        event.preventDefault();
        break;
      case "ArrowLeft":
        if (index > 0) moveTo(slices[index - 1].key);
        event.preventDefault();
        break;
      case "Home":
        moveTo(slices[0].key);
        event.preventDefault();
        break;
      case "End":
        moveTo(slices[slices.length - 1].key);
        event.preventDefault();
        break;
      default:
        break;
    }
  });

  // Called after a legend toggle rebuilds the hotspot layer's contents.
  // If the hidden category was the one focused, falls back to the first
  // remaining slice -- there's no "equivalent position" to preserve the
  // way the bar charts can (a ring has no natural neighbor once a slice
  // is gone and every angle around it has shifted).
  function restoreAfterRebuild() {
    const stillVisible = slices.some((s) => s.key === current.dataset.sliceKey);
    const restored = stillVisible
      ? findHotspot(layer, current.dataset.sliceKey)
      : layer.querySelector(".hotspot");
    if (restored) {
      restored.tabIndex = 0;
      current = restored;
    }
  }

  return { restoreAfterRebuild };
}

// ---------------------------------------------------------------------
// Segment highlight: syncs a visible focus/hover indicator onto the
// actual SVG slice, since the hotspot button's own native outline (which
// always follows its full rectangular box, not its clip-path shape) would
// otherwise draw a rectangle around the WHOLE chart on every hover/focus.
// See the file header comment and .hotspot--donut:focus-visible in
// chart.css, which suppresses that native outline specifically so this
// is the only focus/hover indicator shown for these hotspots.
// ---------------------------------------------------------------------

function wireSegmentHighlight(layer, svg) {
  function setActive(key, active) {
    const path = svg.querySelector(`.chart-donut-slice[data-slice-key="${key}"]`);
    path?.classList.toggle("chart-donut-slice--active", active);
  }

  function handleEnter(event) {
    const target = event.target.closest(".hotspot--donut");
    if (target) setActive(target.dataset.sliceKey, true);
  }

  function handleLeave(event) {
    const target = event.target.closest(".hotspot--donut");
    if (target && target.contains(event.relatedTarget)) return;
    if (target) setActive(target.dataset.sliceKey, false);
  }

  layer.addEventListener("mouseover", handleEnter);
  layer.addEventListener("mouseout", handleLeave);
  layer.addEventListener("focusin", handleEnter);
  layer.addEventListener("focusout", handleLeave);
}

// ---------------------------------------------------------------------
// Shared tooltip -- identical mechanism to the bar charts' (see
// stacked-bar-chart/script.js for the full rationale); duplicated rather
// than imported, per this project's per-demo hand-written accessibility
// code stance.
// ---------------------------------------------------------------------

function buildTooltip(container, scrollBoundsEl) {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.hidden = true;
  container.append(tooltip);

  const EDGE_MARGIN = 8;

  // anchorRect, not target -- see wireTooltip's getAnchorRect param below.
  // For a plain rectangular hotspot (or the toolbar's own buttons),
  // target.getBoundingClientRect() IS the anchor. It is NOT for a donut
  // hotspot: that button's own DOM box covers the entire chart (clip-path
  // only restricts paint/hit-testing, not layout geometry -- see
  // .hotspot--donut in chart.css), so using it here would anchor every
  // slice's tooltip to the same point regardless of which wedge is
  // actually hovered.
  function show(target, anchorRect) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = anchorRect || target.getBoundingClientRect();

    tooltip.textContent = target.dataset.tooltip;
    tooltip.hidden = false;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    const anchorX = targetRect.left - containerRect.left + targetRect.width / 2;
    const anchorTop = targetRect.top - containerRect.top;
    const anchorBottom = anchorTop + targetRect.height;

    const boundsRect = scrollBoundsEl ? scrollBoundsEl.getBoundingClientRect() : containerRect;
    const visibleLeft = Math.max(0, boundsRect.left - containerRect.left);
    const visibleRight = Math.min(containerRect.width, visibleLeft + boundsRect.width);

    const maxLeft = Math.max(
      visibleLeft + EDGE_MARGIN,
      visibleRight - tooltipWidth - EDGE_MARGIN
    );
    const left = Math.min(
      Math.max(anchorX - tooltipWidth / 2, visibleLeft + EDGE_MARGIN),
      maxLeft
    );

    const showBelow = anchorTop < tooltipHeight + EDGE_MARGIN * 2;
    let top = showBelow ? anchorBottom + 10 : anchorTop - tooltipHeight - 10;
    // Vertical clamp against the container's own bounds -- this chart has
    // no scroll wrapper, and its legend sits directly below with little
    // margin, so an unclamped tooltip near the ring's bottom edge could
    // otherwise render over the legend instead of staying inside the
    // chart canvas.
    const visibleBottom = containerRect.height;
    const maxTop = Math.max(EDGE_MARGIN, visibleBottom - tooltipHeight - EDGE_MARGIN);
    top = Math.min(Math.max(top, EDGE_MARGIN), maxTop);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hide() {
    tooltip.hidden = true;
  }

  return { show, hide };
}

// getAnchorRect, if given, computes the tooltip's screen-space anchor
// point independently of the target's own getBoundingClientRect() -- see
// buildTooltip's own comment on `show` for why the donut chart needs
// this and the bar charts never did.
function wireTooltip(layer, tooltip, selector = ".hotspot", getAnchorRect) {
  function handleEnter(event) {
    const target = event.target.closest(selector);
    if (!target) return;
    const ownerDetails = target.closest("details");
    if (ownerDetails && ownerDetails.open && target.tagName === "SUMMARY") return;
    tooltip.show(target, getAnchorRect?.(target));
  }

  function handleLeave(event) {
    const target = event.target.closest(selector);
    if (!target) return;
    if (target.contains(event.relatedTarget)) return;
    tooltip.hide();
  }

  layer.addEventListener("mouseover", handleEnter);
  layer.addEventListener("mouseout", handleLeave);
  layer.addEventListener("focusin", handleEnter);
  layer.addEventListener("focusout", handleLeave);
}

// Computes a zero-size anchor "rect" at a donut hotspot's actual visual
// midpoint (same angle/radius the percentage label is drawn at), in
// screen coordinates -- converts from the fixed 500x500 viewBox-unit
// space via the canvas's own current rendered size, the same uniform
// scale factor .chart-hotspots--donut's CSS transform already uses (see
// chart.css), just computed in JS here since this needs an actual number,
// not a CSS expression.
function donutAnchorRect(chartCanvas) {
  return (target) => {
    const key = target.dataset.sliceKey;
    const slice = allSlices.find((s) => s.key === key);
    if (!slice) return undefined;
    const mid = slice.startAngle + (slice.endAngle - slice.startAngle) / 2;
    const [x, y] = midpoint(LABEL_RADIUS, mid);
    const canvasRect = chartCanvas.getBoundingClientRect();
    const scale = canvasRect.width / VIEWBOX_SIZE;
    const left = canvasRect.left + x * scale;
    const top = canvasRect.top + y * scale;
    return { left, right: left, top, bottom: top, width: 0, height: 0 };
  };
}

// ---------------------------------------------------------------------
// Pattern toggle -- identical mechanism to the bar charts'.
// ---------------------------------------------------------------------

function wirePatternToggle(toggleButton, demoRoot) {
  if (!toggleButton) return;
  toggleButton.addEventListener("click", () => {
    const pressed = toggleButton.getAttribute("aria-pressed") === "true";
    toggleButton.setAttribute("aria-pressed", String(!pressed));
    demoRoot.classList.toggle("patterns-visible", !pressed);
  });
}

// ---------------------------------------------------------------------
// Keyboard shortcuts panel -- identical mechanism to the bar charts'.
// ---------------------------------------------------------------------

function wireKeyboardPanel(details, demoRoot, toolbarTooltip) {
  if (!details) return;
  const summary = details.querySelector("summary");
  const panel = details.querySelector(".keyboard-panel");
  if (!summary || !panel) return;

  const EDGE_MARGIN = 8;

  details.addEventListener("toggle", () => {
    if (!details.open) return;
    toolbarTooltip?.hide();
    const offsetParent = panel.offsetParent;
    if (!offsetParent) return;
    const parentRect = offsetParent.getBoundingClientRect();
    const demoRect = demoRoot.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;

    let minPageLeft = demoRect.left + EDGE_MARGIN;
    let maxPageLeft = demoRect.right - panelWidth - EDGE_MARGIN;
    if (minPageLeft > maxPageLeft) {
      minPageLeft = demoRect.left;
      maxPageLeft = demoRect.right - panelWidth;
    }
    const pageLeft = Math.min(Math.max(summaryRect.left, minPageLeft), maxPageLeft);

    panel.style.left = `${pageLeft - parentRect.left}px`;
  });
}

// ---------------------------------------------------------------------
// Legend as an interactive filter -- same aria-pressed/live-region/
// aria-disabled-last-one idiom as the bar charts, but NOT the same
// "re-stack" effect: hiding a category here does not touch any other
// slice's angle. It only removes that one slice (and its hotspot) from
// what's drawn, leaving a real, proportional gap in the ring -- see the
// file header comment and buildCenterLabel above for why re-normalizing
// a part-to-whole chart back to a full circle would be actively
// misleading, not just a cosmetic difference from the bar charts.
// ---------------------------------------------------------------------

function renderLegend(container) {
  const list = document.createElement("ul");
  list.className = "chart-legend";

  donutData.forEach(({ key, name }) => {
    const item = document.createElement("li");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-legend__toggle";
    button.setAttribute("aria-pressed", "true");
    button.dataset.seriesKey = key;

    const swatch = document.createElement("span");
    swatch.className = "chart-legend__swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.dataset.pattern = String(seriesColors[key]);
    swatch.style.setProperty("--swatch-color", `var(--series-${seriesColors[key]})`);

    const label = document.createElement("span");
    label.className = "chart-legend__label";
    label.textContent = name;

    button.append(swatch, label);
    item.append(button);
    list.append(item);
  });

  container.append(list);
  return list;
}

function wireLegendToggling({ legendList, svg, hotspotLayer, keyboardNav, statusRegion }) {
  const buttons = Array.from(legendList.querySelectorAll(".chart-legend__toggle"));

  function refreshButtonStates() {
    const visibleCount = donutData.length - hiddenKeys.size;
    buttons.forEach((btn) => {
      const key = btn.dataset.seriesKey;
      const shown = !hiddenKeys.has(key);
      btn.setAttribute("aria-pressed", String(shown));
      btn.setAttribute("aria-disabled", String(shown && visibleCount === 1));
    });
  }

  function handleToggle(key, name) {
    const wasVisible = !hiddenKeys.has(key);
    const visibleCount = donutData.length - hiddenKeys.size;
    if (wasVisible && visibleCount === 1) return;

    if (wasVisible) hiddenKeys.add(key);
    else hiddenKeys.delete(key);

    slices = visibleSlices();
    updateChart(svg);
    populateHotspots(hotspotLayer);
    keyboardNav.restoreAfterRebuild();
    refreshButtonStates();

    if (statusRegion) {
      const entry = donutData.find((d) => d.key === key);
      const pct = Math.round((entry.value / TOTAL_CLAIMS) * 100);
      statusRegion.textContent = wasVisible
        ? `${name} hidden. The ring now has a gap where it was — ${entry.value} of ${TOTAL_CLAIMS} total claims (${pct}%) not shown.`
        : `${name} shown again.`;
    }
  }

  buttons.forEach((btn) => {
    const entry = donutData.find((d) => d.key === btn.dataset.seriesKey);
    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-disabled") === "true") return;
      handleToggle(entry.key, entry.name);
    });
  });
}

// ---------------------------------------------------------------------
// Data table fallback (sortable) -- same dataset, tabular presentation.
// ---------------------------------------------------------------------

function renderDataTable(container) {
  const table = container.querySelector("table");
  const tbody = table.querySelector("tbody");
  const headers = Array.from(table.querySelectorAll("th[data-sort-key]"));

  let sortKey = "value";
  let sortDirection = "descending";

  function currentRows() {
    const total = donutData.reduce((sum, d) => sum + d.value, 0);
    const rows = donutData.map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) }));

    rows.sort((a, b) => {
      let cmp;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = a[sortKey] - b[sortKey];
      return sortDirection === "ascending" ? cmp : -cmp;
    });

    return rows;
  }

  function render() {
    tbody.innerHTML = "";
    currentRows().forEach((row) => {
      const tr = document.createElement("tr");
      const nameCell = document.createElement("th");
      nameCell.scope = "row";
      nameCell.textContent = row.name;
      tr.append(nameCell);

      const valueCell = document.createElement("td");
      valueCell.textContent = String(row.value);
      tr.append(valueCell);

      const pctCell = document.createElement("td");
      pctCell.textContent = `${row.pct}%`;
      tr.append(pctCell);

      tbody.append(tr);
    });

    headers.forEach((th) => {
      const key = th.dataset.sortKey;
      th.setAttribute("aria-sort", key === sortKey ? sortDirection : "none");
    });
  }

  headers.forEach((th) => {
    const button = th.querySelector("button");
    button.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (sortKey === key) {
        sortDirection = sortDirection === "ascending" ? "descending" : "ascending";
      } else {
        sortKey = key;
        sortDirection = key === "name" ? "ascending" : "descending";
      }
      render();
    });
  });

  render();
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const chartCanvas = document.getElementById("donut-chart");
  let svg = null;
  let hotspotLayer = null;
  let keyboardNav = null;
  if (chartCanvas) {
    svg = renderChart(chartCanvas);
    hotspotLayer = buildHotspotLayer(chartCanvas);
    keyboardNav = wireKeyboardNav(hotspotLayer);
    const tooltip = buildTooltip(chartCanvas);
    wireTooltip(hotspotLayer, tooltip, ".hotspot", donutAnchorRect(chartCanvas));
    wireSegmentHighlight(hotspotLayer, svg);
  }

  const demoRoot = document.getElementById("donut-demo");
  const patternToggle = document.getElementById("donut-pattern-toggle");
  if (demoRoot) wirePatternToggle(patternToggle, demoRoot);

  const toolbar = document.querySelector(".chart-toolbar");
  let toolbarTooltip = null;
  if (toolbar) {
    toolbarTooltip = buildTooltip(toolbar);
    wireTooltip(toolbar, toolbarTooltip, ".toolbar-btn");
  }

  const keyboardDetails = document.querySelector(".keyboard-details");
  if (demoRoot) {
    wireKeyboardPanel(keyboardDetails, demoRoot, toolbarTooltip);
  }
  makeDetailsDismissible(keyboardDetails);

  const legendContainer = document.getElementById("donut-legend");
  if (legendContainer) {
    const legendList = renderLegend(legendContainer);
    if (svg && hotspotLayer && keyboardNav) {
      wireLegendToggling({
        legendList,
        svg,
        hotspotLayer,
        keyboardNav,
        statusRegion: document.getElementById("donut-legend-status"),
      });
    }
  }

  const tableContainer = document.getElementById("donut-table-wrapper");
  if (tableContainer) renderDataTable(tableContainer);
});
