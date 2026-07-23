/*
  Demo dataset: monthly insurance claims by category, Jan 2023-Jun 2025
  (30 months). Fictional but shaped like real claims data: storm damage
  spikes in spring/autumn, pipe-burst water damage spikes in winter, and
  "Wildlife & Unusual Incidents" spikes every October/November (deer
  season, and yes, raccoons). Kept in sync with data.csv by hand -- if you
  change one, change the other.
*/

export const seriesNames = [
  "Auto Collision",
  "Weather & Storm Damage",
  "Water Damage (Non-Weather)",
  "Liability Claims",
  "Wildlife & Unusual Incidents",
];

export const stackedBarData = [
  { month: "2023-01", values: [24, 6, 17, 7, 4] },
  { month: "2023-02", values: [24, 10, 15, 8, 2] },
  { month: "2023-03", values: [19, 25, 5, 7, 3] },
  { month: "2023-04", values: [22, 22, 7, 9, 2] },
  { month: "2023-05", values: [25, 28, 6, 7, 4] },
  { month: "2023-06", values: [20, 7, 6, 9, 3] },
  { month: "2023-07", values: [25, 9, 7, 10, 3] },
  { month: "2023-08", values: [23, 10, 7, 9, 3] },
  { month: "2023-09", values: [24, 19, 6, 7, 3] },
  { month: "2023-10", values: [19, 20, 6, 9, 8] },
  { month: "2023-11", values: [21, 22, 6, 10, 9] },
  { month: "2023-12", values: [23, 7, 21, 7, 3] },
  { month: "2024-01", values: [27, 9, 20, 9, 4] },
  { month: "2024-02", values: [25, 7, 15, 7, 3] },
  { month: "2024-03", values: [19, 31, 8, 7, 3] },
  { month: "2024-04", values: [21, 30, 7, 7, 3] },
  { month: "2024-05", values: [23, 22, 7, 10, 3] },
  { month: "2024-06", values: [19, 10, 7, 6, 2] },
  { month: "2024-07", values: [18, 9, 8, 8, 3] },
  { month: "2024-08", values: [21, 10, 7, 10, 4] },
  { month: "2024-09", values: [17, 28, 8, 8, 3] },
  { month: "2024-10", values: [24, 20, 7, 8, 11] },
  { month: "2024-11", values: [26, 22, 7, 7, 11] },
  { month: "2024-12", values: [26, 8, 20, 8, 3] },
  { month: "2025-01", values: [25, 9, 22, 8, 2] },
  { month: "2025-02", values: [20, 6, 23, 10, 4] },
  { month: "2025-03", values: [20, 20, 8, 10, 3] },
  { month: "2025-04", values: [22, 20, 8, 9, 3] },
  { month: "2025-05", values: [22, 26, 6, 9, 3] },
  { month: "2025-06", values: [19, 9, 8, 7, 3] },
];

const MONTH_LABELS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_LABELS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatMonth(monthKey, { short = false } = {}) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = (short ? MONTH_LABELS_SHORT : MONTH_LABELS_FULL)[month - 1];
  return short ? `${label} '${String(year).slice(2)}` : `${label} ${year}`;
}
