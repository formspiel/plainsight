/*
  Stacked Bar Chart demo.

  This file is meant to be read, not just executed -- it's the reference
  implementation for the site's first chart-page template, so the ARIA and
  keyboard-handling decisions are commented inline rather than abstracted
  away. See the "Expected accessibility tree" and "Keyboard pattern"
  sections on this page for the prose version of what's happening here.

  Pattern used: the visual <svg> is aria-hidden and purely decorative. A
  parallel layer of real, invisible <button> elements ("hotspots"),
  positioned exactly over each bar and each segment, carries all the
  accessibility semantics. This sidesteps uneven AT support for ARIA on
  SVG shapes (see the Canvas vs SVG cross-cutting page) and means focus
  movement alone -- no custom aria-live announcements -- is what drives
  screen reader output, because real native-button focus is announced
  automatically by every AT/browser combination.
*/

import { linearScale, rectPath } from "../../js/svg-helpers.js";
import { makeDetailsDismissible } from "../../js/details-dismiss.js";
import { stackedBarData, seriesNames, formatMonth } from "./data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 520;
const MARGIN = { top: 24, right: 24, bottom: 118, left: 56 };
const Y_MAX = 80;
const Y_TICKS = [0, 20, 40, 60, 80];

const PATTERN_KINDS = ["diagonal", "dots", "crosshatch", "horizontal", "vertical"];

const plotWidth = VIEWBOX_WIDTH - MARGIN.left - MARGIN.right;
const plotHeight = VIEWBOX_HEIGHT - MARGIN.top - MARGIN.bottom;

const yScale = linearScale({
  domain: [0, Y_MAX],
  range: [MARGIN.top + plotHeight, MARGIN.top],
});

const bandwidth = plotWidth / stackedBarData.length;
const barWidth = bandwidth * 0.68;

function xForIndex(index) {
  return MARGIN.left + index * bandwidth + (bandwidth - barWidth) / 2;
}

// Cumulative stack per month, bottom-up, in seriesNames order.
const stacks = stackedBarData.map(({ month, values }) => {
  let cumulative = 0;
  const segments = values.map((value, seriesIndex) => {
    const start = cumulative;
    cumulative += value;
    return { seriesIndex, value, start, end: cumulative };
  });
  return { month, total: cumulative, segments };
});

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function buildPatternDefs() {
  const defs = svgEl("defs");
  // A CSS custom property, not a literal color: prefers-contrast:more and
  // forced-colors both override --pattern-stroke (see tokens.css) so the
  // pattern lines stay visible/compliant without any JS branching here.
  const stroke = "var(--pattern-stroke)";

  PATTERN_KINDS.forEach((kind, i) => {
    const pattern = svgEl("pattern", {
      id: `stacked-bar-pattern-${i + 1}`,
      width: 8,
      height: 8,
      patternUnits: "userSpaceOnUse",
    });

    if (kind === "diagonal") {
      pattern.append(
        svgEl("path", { d: "M0,8 L8,0", stroke, "stroke-width": 1.4 })
      );
    } else if (kind === "vertical") {
      pattern.append(
        svgEl("line", { x1: 4, y1: 0, x2: 4, y2: 8, stroke, "stroke-width": 1.4 })
      );
    } else if (kind === "dots") {
      pattern.append(svgEl("circle", { cx: 4, cy: 4, r: 1.5, fill: stroke }));
    } else if (kind === "crosshatch") {
      pattern.append(
        svgEl("path", { d: "M0,8 L8,0 M0,0 L8,8", stroke, "stroke-width": 1.2 })
      );
    } else if (kind === "horizontal") {
      pattern.append(
        svgEl("line", { x1: 0, y1: 4, x2: 8, y2: 4, stroke, "stroke-width": 1.4 })
      );
    }

    defs.append(pattern);
  });

  return defs;
}

function buildAxes() {
  const group = svgEl("g", { class: "chart-axes" });

  // Y axis gridlines + labels
  Y_TICKS.forEach((tick) => {
    const y = yScale(tick);
    group.append(
      svgEl("line", {
        x1: MARGIN.left,
        x2: VIEWBOX_WIDTH - MARGIN.right,
        y1: y,
        y2: y,
        class: "chart-gridline",
      })
    );
    const label = svgEl("text", {
      x: MARGIN.left - 10,
      y: y + 4,
      class: "chart-axis-label",
      "text-anchor": "end",
    });
    label.textContent = String(tick);
    group.append(label);
  });

  // X axis baseline
  group.append(
    svgEl("line", {
      x1: MARGIN.left,
      x2: VIEWBOX_WIDTH - MARGIN.right,
      y1: yScale(0),
      y2: yScale(0),
      class: "chart-axis-baseline",
    })
  );

  // X axis month labels, rotated -- 30 labels at this width need it.
  // (This density is exactly the kind of case the "Navigation at scale"
  // and "Reflow at small viewports" cross-cutting pages will cover.)
  stacks.forEach((stack, i) => {
    const x = xForIndex(i) + barWidth / 2;
    const y = yScale(0) + 14;
    const label = svgEl("text", {
      x,
      y,
      class: "chart-axis-label chart-axis-label--month",
      "text-anchor": "end",
      transform: `rotate(-55 ${x} ${y})`,
    });
    label.textContent = formatMonth(stack.month, { short: true });
    group.append(label);
  });

  return group;
}

function buildBars() {
  const group = svgEl("g", { class: "chart-bars" });

  stacks.forEach((stack, barIndex) => {
    const x = xForIndex(barIndex);

    // Grouped per bar so the entrance animation scales the whole bar up
    // from the baseline as one unit, not each segment separately from
    // its own position. transform-origin: bottom (in chart.css) works
    // here without any extra math: every bar's own bounding box already
    // starts at the shared baseline, since that's where every stack
    // begins. Suppressed under prefers-reduced-motion -- see chart.css.
    // Purely visual: the hotspot overlay is positioned independently and
    // is immediately correct/interactive, animation or not.
    const barGroup = svgEl("g", {
      class: "chart-bar-group",
      style: `animation-delay: ${barIndex * 15}ms`,
    });

    stack.segments.forEach((segment) => {
      const y = yScale(segment.end);
      const h = yScale(segment.start) - yScale(segment.end);

      const fill = svgEl("path", {
        d: rectPath(x, y, barWidth, h),
        fill: `var(--series-${segment.seriesIndex + 1})`,
        stroke: "var(--series-stroke)",
        "stroke-width": 1,
      });
      const pattern = svgEl("path", {
        d: rectPath(x, y, barWidth, h),
        fill: `url(#stacked-bar-pattern-${segment.seriesIndex + 1})`,
        class: "segment-pattern",
      });

      barGroup.append(fill, pattern);
    });

    group.append(barGroup);
  });

  return group;
}

function renderChart(container) {
  const svg = svgEl("svg", {
    viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
    class: "chart-svg",
    // Purely decorative: the hotspot overlay carries all a11y semantics.
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.append(buildPatternDefs(), buildAxes(), buildBars());
  container.append(svg);
}

// ---------------------------------------------------------------------
// Accessible hotspot overlay: one "bar summary" stop + one stop per
// segment, per month. Roving tabindex means the whole chart is a single
// Tab stop -- Arrow keys move within it -- so 30 months x 6 stops each
// does not turn into 180 Tab stops for keyboard users.
// ---------------------------------------------------------------------

function segmentDescription(stack, segment) {
  const pct = Math.round((segment.value / stack.total) * 100);
  return `${formatMonth(stack.month)}, ${seriesNames[segment.seriesIndex]}: ${segment.value} claims, ${pct}% of this month's total.`;
}

function barDescription(stack) {
  return `${formatMonth(stack.month)}: ${stack.total} claims total.`;
}

function buildHotspot({ x, y, width, height, text, barIndex, level }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hotspot";
  button.dataset.barIndex = String(barIndex);
  button.dataset.level = String(level); // "bar" or a segment index
  button.dataset.tooltip = text; // read by the shared tooltip on hover/focus
  button.tabIndex = -1;
  button.style.left = `${(x / VIEWBOX_WIDTH) * 100}%`;
  button.style.top = `${(y / VIEWBOX_HEIGHT) * 100}%`;
  button.style.width = `${(width / VIEWBOX_WIDTH) * 100}%`;
  button.style.height = `${(height / VIEWBOX_HEIGHT) * 100}%`;

  const label = document.createElement("span");
  label.className = "visually-hidden";
  label.textContent = text;
  button.append(label);

  return button;
}

function buildHotspotLayer(container) {
  const layer = document.createElement("div");
  layer.className = "chart-hotspots";
  layer.setAttribute("role", "group");
  // Named from the visible chart title, which itself contains a
  // visually-hidden "Stacked bar chart:" type-prefix span as a child --
  // reference only the title id here, not both ids, since referencing
  // the prefix span separately as well as its ancestor title would
  // duplicate the prefix text in the computed accessible name.
  layer.setAttribute("aria-labelledby", "stacked-bar-title");
  layer.setAttribute("aria-describedby", "stacked-bar-instructions");

  stacks.forEach((stack, barIndex) => {
    const x = xForIndex(barIndex);

    layer.append(
      buildHotspot({
        x,
        y: yScale(stack.total),
        width: barWidth,
        height: yScale(0) - yScale(stack.total),
        text: barDescription(stack),
        barIndex,
        level: "bar",
      })
    );

    stack.segments.forEach((segment) => {
      layer.append(
        buildHotspot({
          x,
          y: yScale(segment.end),
          width: barWidth,
          height: yScale(segment.start) - yScale(segment.end),
          text: segmentDescription(stack, segment),
          barIndex,
          level: segment.seriesIndex,
        })
      );
    });
  });

  container.append(layer);
  return layer;
}

function levelKey(level) {
  return level === "bar" ? "bar" : String(level);
}

function findHotspot(layer, barIndex, level) {
  return layer.querySelector(
    `.hotspot[data-bar-index="${barIndex}"][data-level="${levelKey(level)}"]`
  );
}

function wireKeyboardNav(layer) {
  const seriesCount = seriesNames.length;
  let current = layer.querySelector('.hotspot[data-bar-index="0"][data-level="bar"]');
  current.tabIndex = 0;

  function moveTo(barIndex, level) {
    const next = findHotspot(layer, barIndex, level);
    if (!next) return;
    current.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
    current = next;
  }

  layer.addEventListener("keydown", (event) => {
    const barIndex = Number(current.dataset.barIndex);
    const level = current.dataset.level === "bar" ? "bar" : Number(current.dataset.level);

    switch (event.key) {
      case "ArrowRight":
        if (barIndex < stacks.length - 1) moveTo(barIndex + 1, level);
        event.preventDefault();
        break;
      case "ArrowLeft":
        if (barIndex > 0) moveTo(barIndex - 1, level);
        event.preventDefault();
        break;
      case "ArrowDown":
        // Down = move down the visual stack: from the bar summary into
        // the topmost segment, then down toward the base.
        if (level === "bar") moveTo(barIndex, seriesCount - 1);
        else if (level > 0) moveTo(barIndex, level - 1);
        event.preventDefault();
        break;
      case "ArrowUp":
        // Up = move up the visual stack, then back out to the bar summary.
        if (level !== "bar" && level < seriesCount - 1) moveTo(barIndex, level + 1);
        else if (level !== "bar") moveTo(barIndex, "bar");
        event.preventDefault();
        break;
      case "Home":
        moveTo(0, level);
        event.preventDefault();
        break;
      case "End":
        moveTo(stacks.length - 1, level);
        event.preventDefault();
        break;
      case "Escape":
        if (level !== "bar") moveTo(barIndex, "bar");
        break;
      default:
        break;
    }
  });
}

// ---------------------------------------------------------------------
// Shared tooltip: one floating element per container, not one popover
// per target (180 hotspots would make that wasteful, and it's reused
// below for the toolbar's icon-only buttons too). Shown on hover AND
// focus, so a sighted keyboard user sees the same value/label a sighted
// mouse user would. It's aria-hidden because the content it shows always
// duplicates the target's own accessible name (the hotspot's text
// content, or a toolbar button's aria-label) -- AT users already get
// that on focus, so this is a sighted-only convenience, never a second
// source of truth.
// ---------------------------------------------------------------------

function buildTooltip(container, scrollBoundsEl) {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.hidden = true;
  container.append(tooltip);

  const EDGE_MARGIN = 8; // keep the tooltip this far from the container's edges

  function show(target) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    // Set content and reveal first -- we need the tooltip's actual
    // rendered size (it wraps at different widths depending on the text)
    // to clamp it, and an element with `hidden` measures as 0x0.
    tooltip.textContent = target.dataset.tooltip;
    tooltip.hidden = false;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    const anchorX = targetRect.left - containerRect.left + targetRect.width / 2;
    const anchorTop = targetRect.top - containerRect.top;
    const anchorBottom = anchorTop + targetRect.height;

    // Clamp against the currently *visible* window (scrollBoundsEl, e.g.
    // .chart-scroll), not just the container's own full box -- container
    // can be wider than what's actually on screen once it's horizontally
    // scrollable (see .chart-canvas), so clamping against its full width
    // alone would let a tooltip sit outside the visible, scrolled area
    // and get clipped by the scroll container's own overflow instead of
    // staying on-screen. Falls back to the container's own bounds when
    // there's nothing to scroll (e.g. the toolbar's tooltip).
    const boundsRect = scrollBoundsEl ? scrollBoundsEl.getBoundingClientRect() : containerRect;
    const visibleLeft = Math.max(0, boundsRect.left - containerRect.left);
    const visibleRight = Math.min(containerRect.width, visibleLeft + boundsRect.width);

    // Horizontal: center on the target, then slide back inside the
    // visible bounds if that would push either edge past them --
    // this is the actual fix, centering alone (via CSS transform) has
    // no awareness of the container edges at all.
    const maxLeft = Math.max(
      visibleLeft + EDGE_MARGIN,
      visibleRight - tooltipWidth - EDGE_MARGIN
    );
    const left = Math.min(
      Math.max(anchorX - tooltipWidth / 2, visibleLeft + EDGE_MARGIN),
      maxLeft
    );

    // Vertical: prefer above the target; flip below if there's not
    // enough room above (near the top of the container).
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

// selector defaults to ".hotspot" (the chart's data points); the toolbar
// wiring below passes ".toolbar-btn" to reuse the exact same mechanism.
function wireTooltip(layer, tooltip, selector = ".hotspot") {
  function handleEnter(event) {
    const target = event.target.closest(selector);
    if (!target) return;
    // A <summary> whose <details> is already open is showing its full
    // panel right below/over it -- re-showing the small hover/focus
    // tooltip on top of that panel (e.g. refocusing it after Shift+Tab
    // back in) would just cover the panel's own content a second time.
    const ownerDetails = target.closest("details");
    if (ownerDetails && ownerDetails.open && target.tagName === "SUMMARY") return;
    tooltip.show(target);
  }

  function handleLeave(event) {
    const target = event.target.closest(selector);
    if (!target) return;
    // Don't hide when focus/pointer moves to the target's own child
    // (e.g. the hotspot's hidden label span, or a button's icon) --
    // only hide once we've actually left the target.
    if (target.contains(event.relatedTarget)) return;
    tooltip.hide();
  }

  layer.addEventListener("mouseover", handleEnter);
  layer.addEventListener("mouseout", handleLeave);
  layer.addEventListener("focusin", handleEnter);
  layer.addEventListener("focusout", handleLeave);
}

// ---------------------------------------------------------------------
// Scroll-edge fades: purely a sighted "there's more this way" signal for
// the chart's own horizontal scroll below ~900px (see .chart-scroll in
// chart.css). Driven by actual scroll position, not a fixed guess, so it
// stays correct if the data or the container width ever changes. AT
// users need nothing from this -- the hotspot layer already gives full
// access to every bar regardless of scroll position.
// ---------------------------------------------------------------------

function wireScrollFades(scrollEl, leftFade, rightFade) {
  if (!scrollEl || !leftFade || !rightFade) return;

  function update() {
    const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
    leftFade.classList.toggle("is-visible", scrollEl.scrollLeft > 1);
    rightFade.classList.toggle("is-visible", scrollEl.scrollLeft < maxScroll - 1);
  }

  scrollEl.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  update();
}

// ---------------------------------------------------------------------
// Pattern toggle: patterns are off by default (solid color reads better),
// on by request, and forced on -- with the toggle hidden -- under
// forced-colors, where they stop being optional (see tokens.css).
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
// Keyboard shortcuts panel: positioned in JS, not pinned to a CSS side.
// The toolbar sits top-right of the chart but wraps onto its own line
// (left-aligned) on narrow screens, so a fixed left:0 or right:0 anchor
// overflows one edge or the other depending on viewport width -- same
// edge-clamping approach as the chart's own data-point tooltip, clamped
// against .chart-demo (the widest stable container) but expressed in the
// panel's own offsetParent coordinate space (.chart-toolbar, which is
// itself position: relative) -- NOT demoRoot's, since that's what the
// browser actually positions "left" against.
// ---------------------------------------------------------------------

function wireKeyboardPanel(details, demoRoot, toolbarTooltip) {
  if (!details) return;
  const summary = details.querySelector("summary");
  const panel = details.querySelector(".keyboard-panel");
  if (!summary || !panel) return;

  const EDGE_MARGIN = 8;

  details.addEventListener("toggle", () => {
    if (!details.open) return;
    // The summary's own hover/focus tooltip ("Open keyboard shortcuts")
    // has nothing to add once the full panel is open right next to/over
    // it -- and opening via keyboard (Enter/Space on an already-focused,
    // already-tooltipped summary) doesn't fire a new focus event to hide
    // it on its own, so hide it explicitly here.
    toolbarTooltip?.hide();
    const offsetParent = panel.offsetParent;
    if (!offsetParent) return;
    const parentRect = offsetParent.getBoundingClientRect();
    const demoRect = demoRoot.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;

    // Clamp bounds in page coordinates, against the demo container. On
    // narrow viewports the panel's own width (see .keyboard-panel's
    // calc(100vw - 2.5rem) cap) can already consume nearly all of
    // demoRect's width, leaving no room for an 8px margin on both sides
    // -- fall back to a flush fit against the container edges rather
    // than let the preferred margin push the panel past demoRect.right.
    let minPageLeft = demoRect.left + EDGE_MARGIN;
    let maxPageLeft = demoRect.right - panelWidth - EDGE_MARGIN;
    if (minPageLeft > maxPageLeft) {
      minPageLeft = demoRect.left;
      maxPageLeft = demoRect.right - panelWidth;
    }
    const pageLeft = Math.min(Math.max(summaryRect.left, minPageLeft), maxPageLeft);

    // ...then convert into the offsetParent's coordinate space, since
    // that's what the "left" CSS property is actually relative to.
    panel.style.left = `${pageLeft - parentRect.left}px`;
  });
}

// ---------------------------------------------------------------------
// Legend (static key, not an interactive filter -- see the "Legends as
// filters" cross-cutting page, not yet built, for the interactive case).
// ---------------------------------------------------------------------

function renderLegend(container) {
  const list = document.createElement("ul");
  list.className = "chart-legend";

  seriesNames.forEach((name, i) => {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "chart-legend__swatch";
    swatch.dataset.pattern = String(i + 1);
    swatch.style.setProperty("--swatch-color", `var(--series-${i + 1})`);
    item.append(swatch, document.createTextNode(name));
    list.append(item);
  });

  container.append(list);
}

// ---------------------------------------------------------------------
// Data table fallback (sortable) -- same dataset, tabular presentation.
// ---------------------------------------------------------------------

function renderDataTable(container) {
  const table = container.querySelector("table");
  const tbody = table.querySelector("tbody");
  const headers = Array.from(table.querySelectorAll("th[data-sort-key]"));

  let sortKey = "month";
  let sortDirection = "ascending";

  function currentRows() {
    const rows = stackedBarData.map((d) => ({
      month: d.month,
      values: d.values,
      total: d.values.reduce((a, b) => a + b, 0),
    }));

    rows.sort((a, b) => {
      let cmp;
      if (sortKey === "month") cmp = a.month.localeCompare(b.month);
      else if (sortKey === "total") cmp = a.total - b.total;
      else cmp = a.values[Number(sortKey)] - b.values[Number(sortKey)];
      return sortDirection === "ascending" ? cmp : -cmp;
    });

    return rows;
  }

  function render() {
    tbody.innerHTML = "";
    currentRows().forEach((row) => {
      const tr = document.createElement("tr");
      const monthCell = document.createElement("th");
      monthCell.scope = "row";
      monthCell.textContent = formatMonth(row.month);
      tr.append(monthCell);

      row.values.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      });

      const totalCell = document.createElement("td");
      totalCell.textContent = String(row.total);
      tr.append(totalCell);

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
        sortDirection = "ascending";
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
  const scrollContainer = document.getElementById("stacked-bar-chart");
  const chartCanvas = scrollContainer?.querySelector(".chart-canvas");
  if (chartCanvas) {
    renderChart(chartCanvas);
    const layer = buildHotspotLayer(chartCanvas);
    wireKeyboardNav(layer);
    const tooltip = buildTooltip(chartCanvas, scrollContainer);
    wireTooltip(layer, tooltip);
  }

  const chartFigure = document.querySelector(".chart-figure");
  wireScrollFades(
    scrollContainer,
    chartFigure?.querySelector(".chart-scroll-fade--left"),
    chartFigure?.querySelector(".chart-scroll-fade--right")
  );

  const demoRoot = document.getElementById("stacked-bar-demo");
  const patternToggle = document.getElementById("stacked-bar-pattern-toggle");
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

  const legendContainer = document.getElementById("stacked-bar-legend");
  if (legendContainer) renderLegend(legendContainer);

  const tableContainer = document.getElementById("stacked-bar-table-wrapper");
  if (tableContainer) renderDataTable(tableContainer);
});
