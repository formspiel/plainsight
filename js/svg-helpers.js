/*
  Shared SVG geometry helpers.

  Deliberately minimal: only what the Stacked Bar Chart needs today.
  Axis tick generation ("nice" round numbers) and donut/pie arc math are
  NOT here yet — they're vendored/hand-rolled per CLAUDE.md once the charts
  that need them (Multi-Series Line, Donut/Pie) are built. Do not add them
  here speculatively.

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
