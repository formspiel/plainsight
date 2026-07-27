/*
  Demo dataset: insurance claims by category, full year 2025 (a single
  part-to-whole snapshot, not a time series -- unlike the two bar charts,
  a donut/pie chart shows composition at one point in time, so there's no
  month dimension here). Five of the six categories are the same ones used
  on the Stacked Bar Chart (same category = same color everywhere on the
  site, see seriesColors below); "Theft & Vandalism" is new to this page.
  Kept in sync with data.csv by hand -- if you change one, change the other.

  Slice order is NOT strictly descending by value (Wildlife, 35, comes
  before the larger Theft & Vandalism, 52) -- deliberate, not an oversight.
  See tokens.css's own comment on --series-6 for why: a donut is a ring, so
  its first and last slices are ALSO adjacent, a constraint a stacked bar's
  linear order never has to satisfy. This order is what makes every
  adjacent pair in the ring clear 3:1 contrast under prefers-contrast:more
  (verified, see tokens.css) without touching the other five charts' own
  already-computed series colors.
*/

export const donutData = [
  { key: "auto", name: "Auto Collision", value: 210 },
  { key: "weather", name: "Weather & Storm Damage", value: 130 },
  { key: "water", name: "Water Damage (Non-Weather)", value: 95 },
  { key: "liability", name: "Liability Claims", value: 78 },
  { key: "wildlife", name: "Wildlife & Unusual Incidents", value: 35 },
  { key: "theft", name: "Theft & Vandalism", value: 52 },
];

export const seriesColors = {
  auto: 1,
  weather: 2,
  water: 3,
  liability: 4,
  wildlife: 5,
  theft: 6,
};

export const TOTAL_CLAIMS = donutData.reduce((sum, d) => sum + d.value, 0);
