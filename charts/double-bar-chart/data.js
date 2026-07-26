/*
  Demo dataset: monthly insurance claims decided, Jan 2023-Jun 2025 (30
  months), split into Approved (above the zero line) and Denied (below
  it) -- the same fictional insurer as the Stacked Bar Chart demo, a
  different metric. Fictional but shaped like a real story: a stricter
  review process pushes the denial rate up sharply for a few months in
  early-to-mid 2024, then it's relaxed back down. Kept in sync with
  data.csv by hand -- if you change one, change the other.
*/

export const doubleBarData = [
  { month: "2023-01", approved: 44, denied: 9 },
  { month: "2023-02", approved: 46, denied: 8 },
  { month: "2023-03", approved: 42, denied: 10 },
  { month: "2023-04", approved: 45, denied: 9 },
  { month: "2023-05", approved: 48, denied: 11 },
  { month: "2023-06", approved: 43, denied: 8 },
  { month: "2023-07", approved: 41, denied: 9 },
  { month: "2023-08", approved: 44, denied: 10 },
  { month: "2023-09", approved: 47, denied: 9 },
  { month: "2023-10", approved: 50, denied: 12 },
  { month: "2023-11", approved: 49, denied: 11 },
  { month: "2023-12", approved: 45, denied: 9 },
  { month: "2024-01", approved: 38, denied: 22 },
  { month: "2024-02", approved: 36, denied: 24 },
  { month: "2024-03", approved: 35, denied: 26 },
  { month: "2024-04", approved: 37, denied: 23 },
  { month: "2024-05", approved: 39, denied: 20 },
  { month: "2024-06", approved: 42, denied: 15 },
  { month: "2024-07", approved: 44, denied: 12 },
  { month: "2024-08", approved: 46, denied: 10 },
  { month: "2024-09", approved: 48, denied: 9 },
  { month: "2024-10", approved: 51, denied: 11 },
  { month: "2024-11", approved: 50, denied: 10 },
  { month: "2024-12", approved: 47, denied: 9 },
  { month: "2025-01", approved: 45, denied: 8 },
  { month: "2025-02", approved: 43, denied: 9 },
  { month: "2025-03", approved: 46, denied: 10 },
  { month: "2025-04", approved: 48, denied: 9 },
  { month: "2025-05", approved: 50, denied: 11 },
  { month: "2025-06", approved: 47, denied: 9 },
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
