/*
  Shared SVG geometry helpers.

  Deliberately minimal: linear scale + path builders for the bar charts,
  plus donut/pie arc math (see donutArcPath below), hand-rolled per
  CLAUDE.md's tech-stack table rather than pulled in as a dependency --
  stable, well-documented math, not the kind of edge-case-heavy problem
  (like "nice" axis tick generation, still not here) worth vendoring a
  library for. Axis tick generation itself is NOT here yet -- it'll be
  vendored once a chart that needs it (Multi-Series Line) is built. Do not
  add it here speculatively.

  Accessibility wiring (ARIA, keyboard handling) is intentionally NOT in
  this file — it stays hand-written in each chart's own script so it stays
  readable end to end.
*/

/**
 * Builds a linear scale mapping a numeric domain to a pixel range.
 * Returns a function value -> pixel, with an .invert(pixel) -> value method.
 */
export function linearScale({ domain, range }) {
  const [d0, d1] = domain;
  const [r0, r1] = range;

  const scale = (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
  scale.invert = (pixel) => d0 + ((pixel - r0) / (r1 - r0)) * (d1 - d0);

  return scale;
}

/**
 * Builds an SVG path `d` string connecting a list of [x, y] points with
 * straight line segments.
 */
export function pathFromPoints(points, { close = false } = {}) {
  if (points.length === 0) return "";

  const [first, ...rest] = points;
  const commands = [
    `M ${first[0]} ${first[1]}`,
    ...rest.map(([x, y]) => `L ${x} ${y}`),
  ];
  if (close) commands.push("Z");

  return commands.join(" ");
}

/** Builds a rectangle as an SVG path `d` string (used for bar segments). */
export function rectPath(x, y, width, height) {
  return pathFromPoints(
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
    { close: true }
  );
}

/**
 * Builds an SVG path `d` string for one slice of a donut/pie chart: the
 * annulus between innerRadius and outerRadius, sweeping clockwise from
 * startAngle to endAngle (radians, 0 = 12 o'clock/north -- matching how a
 * reader's eye and a clock face both read angle, not SVG's own 0 = 3
 * o'clock convention). innerRadius of 0 draws a plain pie wedge instead of
 * a donut segment; the two share this one function since the only
 * difference is whether the two straight edges meet at the center point or
 * at an inner arc.
 *
 * Two edge cases called out in CLAUDE.md's tech-stack table as worth
 * testing carefully, both handled explicitly rather than left to chance:
 *  - A segment spanning the full circle (e.g. a single 100%-of-total
 *    category, or every other category hidden via the legend down to one).
 *    SVG's arc command can't sweep a full 360° in one command -- start and
 *    end point coincide, so the browser draws nothing at all -- so this is
 *    detected and split into two half-circle sweeps instead.
 *  - A near-zero-width segment (a very small category). No special-casing
 *    needed here: the large-arc-flag math and point geometry stay correct
 *    down to an arbitrarily thin sliver, so this "edge case" is really just
 *    confirmation the general math has no lower bound to trip over.
 */
export function donutArcPath({ cx, cy, innerRadius, outerRadius, startAngle, endAngle }) {
  const FULL_CIRCLE = Math.PI * 2 - 1e-6;
  if (endAngle - startAngle >= FULL_CIRCLE) {
    const mid = startAngle + Math.PI;
    return [
      donutArcPath({ cx, cy, innerRadius, outerRadius, startAngle, endAngle: mid }),
      donutArcPath({ cx, cy, innerRadius, outerRadius, startAngle: mid, endAngle }),
    ].join(" ");
  }

  const point = (radius, angle) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const outerStart = point(outerRadius, startAngle);
  const outerEnd = point(outerRadius, endAngle);

  if (innerRadius <= 0) {
    // Plain pie wedge: two straight edges from the center point, closed by
    // one outer arc -- no inner arc to draw at all.
    return [
      `M ${cx} ${cy}`,
      `L ${outerStart[0]} ${outerStart[1]}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]}`,
      "Z",
    ].join(" ");
  }

  const innerStart = point(innerRadius, startAngle);
  const innerEnd = point(innerRadius, endAngle);

  return [
    `M ${outerStart[0]} ${outerStart[1]}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]}`,
    `L ${innerEnd[0]} ${innerEnd[1]}`,
    // Sweep flag 0, not 1: the inner edge is traversed backward (end angle
    // to start angle) to close the shape without crossing itself, so it
    // sweeps the opposite rotational direction from the outer arc above.
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart[0]} ${innerStart[1]}`,
    "Z",
  ].join(" ");
}
