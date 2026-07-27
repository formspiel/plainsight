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

  4. Legend-driven hiding recomputes every visible slice's angle from
     scratch (the remaining slices expand to fill the freed-up 360°) --
     the same "re-stack" idiom the Stacked Bar Chart uses for its
     segment totals, applied to angle instead of height.
*/

import { linearScale, donutArcPath } from "../../js/svg-helpers.js";
import { makeDetailsDismissible } from "../../js/details-dismiss.js";
import { donutData, seriesColors } from "./data.js";

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

function visibleData() {
  return donutData.filter((d) => !hiddenKeys.has(d.key));
}

// Recomputes every visible slice's start/end angle from scratch, in data
// order, clockwise from 12 o'clock (angle 0). A hidden category is simply
// absent from this list -- the remaining slices' angles expand to close
// the gap, the same "re-stack" idiom the Stacked Bar Chart applies to bar
// height, applied here to angle instead.
function computeSlices() {
  const visible = visibleData();
  const total = visible.reduce((sum, d) => sum + d.value, 0);
  let angle = 0;
  return visible.map((d) => {
    const startAngle = angle;
    const sweep = (d.value / total) * Math.PI * 2;
    angle += sweep;
    return { ...d, startAngle, endAngle: angle, total };
  });
}

let slices = computeSlices();

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
      const pct = Math.round((slice.value / slice.total) * 100);
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
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const totalText = svgEl("text", {
    x: CENTER,
    y: CENTER - 6,
    class: "chart-donut-center__total",
    "text-anchor": "middle",
  });
  totalText.textContent = String(total);

  const labelText = svgEl("text", {
    x: CENTER,
    y: CENTER + 18,
    class: "chart-donut-center__label",
    "text-anchor": "middle",
  });
  labelText.textContent = "total claims";

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
  const pct = Math.round((slice.value / slice.total) * 100);
  return `${slice.name}: ${slice.value} claims, ${pct}% of ${slice.total} total claims.`;
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

  function show(target) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

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
    const top = showBelow ? anchorBottom + 10 : anchorTop - tooltipHeight - 10;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hide() {
    tooltip.hidden = true;
  }

  return { show, hide };
}

function wireTooltip(layer, tooltip, selector = ".hotspot") {
  function handleEnter(event) {
    const target = event.target.closest(selector);
    if (!target) return;
    const ownerDetails = target.closest("details");
    if (ownerDetails && ownerDetails.open && target.tagName === "SUMMARY") return;
    tooltip.show(target);
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
// Legend as an interactive filter -- same idiom as the bar charts'
// (aria-pressed toggle buttons, a live-region announcement, the last-
// visible category locked via aria-disabled), applied to angle instead
// of stack height or bar presence: hiding a category recomputes every
// remaining slice's angle so they expand to fill the freed-up 360°.
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

    slices = computeSlices();
    updateChart(svg);
    populateHotspots(hotspotLayer);
    keyboardNav.restoreAfterRebuild();
    refreshButtonStates();

    if (statusRegion) {
      statusRegion.textContent = `${name} ${wasVisible ? "hidden" : "shown"}.`;
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
    wireTooltip(hotspotLayer, tooltip);
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
