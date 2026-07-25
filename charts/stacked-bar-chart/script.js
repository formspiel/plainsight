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
  layer.setAttribute("aria-label", "Insurance claims by category, January 2023 to June 2025, stacked bar chart");
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
// Shared tooltip: one floating element, not one popover per hotspot (180
// of those would be wasteful). Shown on hover AND focus, so a sighted
// keyboard user sees the same value a sighted mouse user would -- that
// gap ("why explore with arrow keys if nothing is visible?") is exactly
// what this fixes. It's aria-hidden because the content it shows is a
// duplicate of the hotspot's own accessible name, already announced by
// AT on focus; a screen reader user doesn't need it read twice.
// ---------------------------------------------------------------------

function buildTooltip(chartFigure) {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.hidden = true;
  chartFigure.append(tooltip);

  const EDGE_MARGIN = 8; // keep the tooltip this far from the container's edges

  function show(hotspot) {
    const figureRect = chartFigure.getBoundingClientRect();
    const hotspotRect = hotspot.getBoundingClientRect();

    // Set content and reveal first -- we need the tooltip's actual
    // rendered size (it wraps at different widths depending on the text)
    // to clamp it, and an element with `hidden` measures as 0x0.
    tooltip.textContent = hotspot.dataset.tooltip;
    tooltip.hidden = false;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    const anchorX = hotspotRect.left - figureRect.left + hotspotRect.width / 2;
    const anchorTop = hotspotRect.top - figureRect.top;
    const anchorBottom = anchorTop + hotspotRect.height;

    // Horizontal: center on the hotspot, then slide back inside the
    // container bounds if that would push either edge past them --
    // this is the actual fix, centering alone (via CSS transform) has
    // no awareness of the container edges at all.
    const maxLeft = Math.max(
      EDGE_MARGIN,
      figureRect.width - tooltipWidth - EDGE_MARGIN
    );
    const left = Math.min(
      Math.max(anchorX - tooltipWidth / 2, EDGE_MARGIN),
      maxLeft
    );

    // Vertical: prefer above the hotspot; flip below if there's not
    // enough room above (near the top of the chart).
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

function wireTooltip(layer, tooltip) {
  function handleEnter(event) {
    const hotspot = event.target.closest(".hotspot");
    if (hotspot) tooltip.show(hotspot);
  }

  function handleLeave(event) {
    const hotspot = event.target.closest(".hotspot");
    if (!hotspot) return;
    // Don't hide when focus/pointer moves to the hotspot's own hidden
    // label span -- only hide once we've actually left the hotspot.
    if (hotspot.contains(event.relatedTarget)) return;
    tooltip.hide();
  }

  layer.addEventListener("mouseover", handleEnter);
  layer.addEventListener("mouseout", handleLeave);
  layer.addEventListener("focusin", handleEnter);
  layer.addEventListener("focusout", handleLeave);
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
  const chartContainer = document.getElementById("stacked-bar-chart");
  if (chartContainer) {
    renderChart(chartContainer);
    const layer = buildHotspotLayer(chartContainer);
    wireKeyboardNav(layer);
    const tooltip = buildTooltip(chartContainer);
    wireTooltip(layer, tooltip);
  }

  const demoRoot = document.getElementById("stacked-bar-demo");
  const patternToggle = document.getElementById("stacked-bar-pattern-toggle");
  if (demoRoot) wirePatternToggle(patternToggle, demoRoot);

  const legendContainer = document.getElementById("stacked-bar-legend");
  if (legendContainer) renderLegend(legendContainer);

  const tableContainer = document.getElementById("stacked-bar-table-wrapper");
  if (tableContainer) renderDataTable(tableContainer);
});
