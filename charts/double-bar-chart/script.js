/*
  Double Bar Graph demo.

  Same overall pattern as the Stacked Bar Chart (aria-hidden decorative
  SVG + a parallel layer of real, invisible <button> hotspots carrying
  all accessibility semantics) -- see that page's script.js for the
  fuller rationale. This file exists separately, not shared, per this
  project's stance that chart accessibility wiring is hand-written per
  demo so it stays readable end to end.

  What's actually different here: there's no cumulative stack. Each
  month has exactly two independent values -- Approved (drawn above a
  shared zero line) and Denied (drawn below it) -- so there's no
  "total" hotspot, no percentage-of-stack math, and hiding one series
  via the legend doesn't require recomputing anything about the other;
  it's a strictly simpler model than the Stacked Bar Chart's.
*/

import { linearScale, rectPath } from "../../js/svg-helpers.js";
import { makeDetailsDismissible } from "../../js/details-dismiss.js";
import { doubleBarData, formatMonth } from "./data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 520;
const MARGIN = { top: 24, right: 24, bottom: 118, left: 56 };
// Signed domain for the y-scale's own math -- the axis LABELS show the
// absolute value instead (see buildAxes): "20" on the Denied side means
// 20 denied claims, not literally -20 of anything. A raw signed axis
// label is a real, common failure pattern for diverging charts (see
// "Common failure patterns" on the page) and this demo deliberately
// doesn't repeat it.
const Y_DOMAIN = [-30, 60];
const Y_TICKS = [-30, -15, 0, 15, 30, 45, 60];

const SERIES = [
  { key: "approved", label: "Approved", index: 1 },
  { key: "denied", label: "Denied", index: 2 },
];

const plotWidth = VIEWBOX_WIDTH - MARGIN.left - MARGIN.right;
const plotHeight = VIEWBOX_HEIGHT - MARGIN.top - MARGIN.bottom;

const yScale = linearScale({
  domain: Y_DOMAIN,
  range: [MARGIN.top + plotHeight, MARGIN.top],
});

const bandwidth = plotWidth / doubleBarData.length;
const barWidth = bandwidth * 0.68;

function xForIndex(index) {
  return MARGIN.left + index * bandwidth + (bandwidth - barWidth) / 2;
}

// Which series are currently hidden via the legend (see
// wireLegendToggling near the bottom) -- unlike the Stacked Bar Chart,
// hiding a series here doesn't change any other value at all (Approved
// and Denied are independent counts, not parts of a whole), so there's
// no equivalent of that demo's computeStacks()/`stacks` reassignment:
// buildBars/populateHotspots just check this set directly on every
// call instead.
let hiddenSeries = new Set();

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

  // Only two kinds needed (one per series), reusing the same hand-rolled
  // patterns as the Stacked Bar Chart -- see that file for why these
  // specific shapes and not e.g. an image-based texture.
  defs.append(
    (() => {
      const pattern = svgEl("pattern", {
        id: "double-bar-pattern-1",
        width: 8,
        height: 8,
        patternUnits: "userSpaceOnUse",
      });
      pattern.append(svgEl("path", { d: "M0,8 L8,0", stroke, "stroke-width": 1.4 }));
      return pattern;
    })(),
    (() => {
      const pattern = svgEl("pattern", {
        id: "double-bar-pattern-2",
        width: 8,
        height: 8,
        patternUnits: "userSpaceOnUse",
      });
      pattern.append(svgEl("circle", { cx: 4, cy: 4, r: 1.5, fill: stroke }));
      return pattern;
    })()
  );

  return defs;
}

function buildAxes() {
  const group = svgEl("g", { class: "chart-axes" });

  Y_TICKS.forEach((tick) => {
    const y = yScale(tick);

    // The zero tick gets the bolder baseline treatment instead of a
    // plain gridline -- it's the one line on this chart with real
    // meaning (everything above it is Approved, everything below is
    // Denied), not just a scale reference.
    if (tick !== 0) {
      group.append(
        svgEl("line", {
          x1: MARGIN.left,
          x2: VIEWBOX_WIDTH - MARGIN.right,
          y1: y,
          y2: y,
          class: "chart-gridline",
        })
      );
    }

    const label = svgEl("text", {
      x: MARGIN.left - 10,
      y: y + 4,
      class: "chart-axis-label",
      "text-anchor": "end",
    });
    label.textContent = String(Math.abs(tick));
    group.append(label);
  });

  // The zero/baseline line -- drawn at the same stroke weight the
  // Stacked Bar Chart uses for its (bottom-edge) baseline, since this
  // one carries the same "this is the meaningful reference line" weight,
  // just positioned in the middle instead of at an edge.
  group.append(
    svgEl("line", {
      x1: MARGIN.left,
      x2: VIEWBOX_WIDTH - MARGIN.right,
      y1: yScale(0),
      y2: yScale(0),
      class: "chart-axis-baseline",
    })
  );

  // Month labels sit below the whole plot area (below the lowest
  // possible Denied bar), not at the zero line -- unlike the Stacked
  // Bar Chart, zero is in the middle here, not at the bottom edge.
  const labelY = MARGIN.top + plotHeight + 14;
  doubleBarData.forEach((bar, i) => {
    const x = xForIndex(i) + barWidth / 2;
    const label = svgEl("text", {
      x,
      y: labelY,
      class: "chart-axis-label chart-axis-label--month",
      "text-anchor": "end",
      transform: `rotate(-55 ${x} ${labelY})`,
    });
    label.textContent = formatMonth(bar.month, { short: true });
    group.append(label);
  });

  return group;
}

function buildBars() {
  const group = svgEl("g", { class: "chart-bars" });

  doubleBarData.forEach((bar, barIndex) => {
    const x = xForIndex(barIndex);

    if (!hiddenSeries.has("approved")) {
      const y = yScale(bar.approved);
      const h = yScale(0) - y;
      const barGroup = svgEl("g", {
        class: "chart-bar-group chart-bar-group--up",
        style: `animation-delay: ${barIndex * 15}ms`,
      });
      barGroup.append(
        svgEl("path", {
          d: rectPath(x, y, barWidth, h),
          fill: "var(--series-1)",
          stroke: "var(--series-stroke)",
          "stroke-width": 1,
        }),
        svgEl("path", {
          d: rectPath(x, y, barWidth, h),
          fill: "url(#double-bar-pattern-1)",
          class: "segment-pattern",
        })
      );
      group.append(barGroup);
    }

    if (!hiddenSeries.has("denied")) {
      const y = yScale(0);
      const h = yScale(-bar.denied) - y;
      const barGroup = svgEl("g", {
        class: "chart-bar-group chart-bar-group--down",
        style: `animation-delay: ${barIndex * 15}ms`,
      });
      barGroup.append(
        svgEl("path", {
          d: rectPath(x, y, barWidth, h),
          fill: "var(--series-2)",
          stroke: "var(--series-stroke)",
          "stroke-width": 1,
        }),
        svgEl("path", {
          d: rectPath(x, y, barWidth, h),
          fill: "url(#double-bar-pattern-2)",
          class: "segment-pattern",
        })
      );
      group.append(barGroup);
    }
  });

  return group;
}

function renderChart(container) {
  const svg = svgEl("svg", {
    viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
    class: "chart-svg",
    "aria-hidden": "true",
    focusable: "false",
  });
  // buildAxes() doesn't depend on hiddenSeries -- only .chart-bars needs
  // replacing when the legend toggles a series (see updateBars).
  svg.append(buildPatternDefs(), buildAxes(), buildBars());
  container.append(svg);
  return svg;
}

function updateBars(svg) {
  const oldBars = svg.querySelector(".chart-bars");
  oldBars.replaceWith(buildBars());
}

// ---------------------------------------------------------------------
// Accessible hotspot overlay: two stops per month (Approved, Denied),
// not the Stacked Bar Chart's bar-summary-plus-segments hierarchy --
// there's no "total" here to summarize, so there's nothing for a third
// stop to say.
// ---------------------------------------------------------------------

function seriesDescription(bar, key) {
  const decided = bar.approved + bar.denied;
  const value = bar[key];
  const pct = Math.round((value / decided) * 100);
  const label = key === "approved" ? "Approved" : "Denied";
  return `${formatMonth(bar.month)}, ${label}: ${value} claims, ${pct}% of ${decided} claims decided.`;
}

function buildHotspot({ x, y, width, height, text, barIndex, level }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hotspot";
  button.dataset.barIndex = String(barIndex);
  button.dataset.level = level; // "approved" or "denied"
  button.dataset.tooltip = text;
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
  layer.setAttribute("aria-labelledby", "double-bar-title");
  layer.setAttribute("aria-describedby", "double-bar-instructions");

  container.append(layer);
  populateHotspots(layer);
  return layer;
}

// Split from buildHotspotLayer so a legend toggle can rebuild just the
// hotspot buttons via the same `layer` element -- its keydown/focus
// listeners (see wireKeyboardNav/wireTooltip) are delegated from
// `layer` itself, not attached per-button, so they survive this.
function populateHotspots(layer) {
  layer.innerHTML = "";

  doubleBarData.forEach((bar, barIndex) => {
    const x = xForIndex(barIndex);

    if (!hiddenSeries.has("approved")) {
      const y = yScale(bar.approved);
      layer.append(
        buildHotspot({
          x,
          y,
          width: barWidth,
          height: yScale(0) - y,
          text: seriesDescription(bar, "approved"),
          barIndex,
          level: "approved",
        })
      );
    }

    if (!hiddenSeries.has("denied")) {
      const y = yScale(0);
      layer.append(
        buildHotspot({
          x,
          y,
          width: barWidth,
          height: yScale(-bar.denied) - y,
          text: seriesDescription(bar, "denied"),
          barIndex,
          level: "denied",
        })
      );
    }
  });
}

function findHotspot(layer, barIndex, level) {
  return layer.querySelector(`.hotspot[data-bar-index="${barIndex}"][data-level="${level}"]`);
}

function wireKeyboardNav(layer) {
  let current = layer.querySelector('.hotspot[data-bar-index="0"][data-level="approved"]');
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
    const level = current.dataset.level;

    switch (event.key) {
      case "ArrowRight":
        if (barIndex < doubleBarData.length - 1) moveTo(barIndex + 1, level);
        event.preventDefault();
        break;
      case "ArrowLeft":
        if (barIndex > 0) moveTo(barIndex - 1, level);
        event.preventDefault();
        break;
      case "ArrowUp":
        // Up = the series drawn above the line. No-ops if Approved is
        // currently hidden via the legend -- there's nothing there to
        // move to, the same way a hidden Stacked Bar Chart segment has
        // no stop to skip into either.
        moveTo(barIndex, "approved");
        event.preventDefault();
        break;
      case "ArrowDown":
        // Down = the series drawn below the line.
        moveTo(barIndex, "denied");
        event.preventDefault();
        break;
      case "Home":
        moveTo(0, level);
        event.preventDefault();
        break;
      case "End":
        moveTo(doubleBarData.length - 1, level);
        event.preventDefault();
        break;
      default:
        break;
    }
  });

  // Called after a legend toggle rebuilds the hotspot layer's contents.
  // `current` is a detached node at this point (still readable) --
  // if the level it was on just got hidden, this switches to the other
  // one instead (guaranteed visible: the legend never allows both to be
  // hidden at once, see wireLegendToggling), same bar.
  function restoreAfterRebuild() {
    const barIndex = Number(current.dataset.barIndex);
    let level = current.dataset.level;
    if (hiddenSeries.has(level)) {
      level = level === "approved" ? "denied" : "approved";
    }

    const restored =
      findHotspot(layer, barIndex, level) ||
      layer.querySelector('.hotspot[data-bar-index="0"]');
    restored.tabIndex = 0;
    current = restored;
  }

  return { restoreAfterRebuild };
}

// ---------------------------------------------------------------------
// Shared tooltip -- identical mechanism to the Stacked Bar Chart's (see
// that file for the full rationale); duplicated rather than imported,
// per this project's per-demo hand-written accessibility code stance.
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
// Scroll-edge fades -- identical mechanism to the Stacked Bar Chart's.
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
// Pattern toggle -- identical mechanism to the Stacked Bar Chart's.
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
// Keyboard shortcuts panel -- identical mechanism to the Stacked Bar
// Chart's (see that file for the full positioning rationale).
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
// Legend as an interactive filter -- same idiom as the Stacked Bar
// Chart's (aria-pressed toggle buttons, a live-region announcement,
// the last-visible series locked via aria-disabled), simplified since
// there's no stack to re-flow: hiding a series just means its hotspot
// and bar don't exist, nothing else changes.
// ---------------------------------------------------------------------

function renderLegend(container) {
  const list = document.createElement("ul");
  list.className = "chart-legend";

  SERIES.forEach(({ key, label, index }) => {
    const item = document.createElement("li");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-legend__toggle";
    button.setAttribute("aria-pressed", "true");
    button.dataset.seriesKey = key;

    const swatch = document.createElement("span");
    swatch.className = "chart-legend__swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.dataset.pattern = String(index);
    swatch.style.setProperty("--swatch-color", `var(--series-${index})`);

    const labelEl = document.createElement("span");
    labelEl.className = "chart-legend__label";
    labelEl.textContent = label;

    button.append(swatch, labelEl);
    item.append(button);
    list.append(item);
  });

  container.append(list);
  return list;
}

function wireLegendToggling({ legendList, svg, hotspotLayer, keyboardNav, statusRegion }) {
  const buttons = Array.from(legendList.querySelectorAll(".chart-legend__toggle"));

  function refreshButtonStates() {
    const visibleCount = SERIES.length - hiddenSeries.size;
    buttons.forEach((btn) => {
      const key = btn.dataset.seriesKey;
      const shown = !hiddenSeries.has(key);
      btn.setAttribute("aria-pressed", String(shown));
      btn.setAttribute("aria-disabled", String(shown && visibleCount === 1));
    });
  }

  function handleToggle(key, label) {
    const wasVisible = !hiddenSeries.has(key);
    const visibleCount = SERIES.length - hiddenSeries.size;
    if (wasVisible && visibleCount === 1) return;

    if (wasVisible) hiddenSeries.add(key);
    else hiddenSeries.delete(key);

    updateBars(svg);
    populateHotspots(hotspotLayer);
    keyboardNav.restoreAfterRebuild();
    refreshButtonStates();

    if (statusRegion) {
      statusRegion.textContent = `${label} ${wasVisible ? "hidden" : "shown"}.`;
    }
  }

  buttons.forEach((btn) => {
    const series = SERIES.find((s) => s.key === btn.dataset.seriesKey);
    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-disabled") === "true") return;
      handleToggle(series.key, series.label);
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

  let sortKey = "month";
  let sortDirection = "ascending";

  function currentRows() {
    const rows = doubleBarData.map((d) => ({ ...d }));

    rows.sort((a, b) => {
      let cmp;
      if (sortKey === "month") cmp = a.month.localeCompare(b.month);
      else cmp = a[sortKey] - b[sortKey];
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

      [row.approved, row.denied].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      });

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
  const scrollContainer = document.getElementById("double-bar-chart");
  const chartCanvas = scrollContainer?.querySelector(".chart-canvas");
  let svg = null;
  let hotspotLayer = null;
  let keyboardNav = null;
  if (chartCanvas) {
    svg = renderChart(chartCanvas);
    hotspotLayer = buildHotspotLayer(chartCanvas);
    keyboardNav = wireKeyboardNav(hotspotLayer);
    const tooltip = buildTooltip(chartCanvas, scrollContainer);
    wireTooltip(hotspotLayer, tooltip);
  }

  const chartFigure = document.querySelector(".chart-figure");
  wireScrollFades(
    scrollContainer,
    chartFigure?.querySelector(".chart-scroll-fade--left"),
    chartFigure?.querySelector(".chart-scroll-fade--right")
  );

  const demoRoot = document.getElementById("double-bar-demo");
  const patternToggle = document.getElementById("double-bar-pattern-toggle");
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

  const legendContainer = document.getElementById("double-bar-legend");
  if (legendContainer) {
    const legendList = renderLegend(legendContainer);
    if (svg && hotspotLayer && keyboardNav) {
      wireLegendToggling({
        legendList,
        svg,
        hotspotLayer,
        keyboardNav,
        statusRegion: document.getElementById("double-bar-legend-status"),
      });
    }
  }

  const tableContainer = document.getElementById("double-bar-table-wrapper");
  if (tableContainer) renderDataTable(tableContainer);
});
