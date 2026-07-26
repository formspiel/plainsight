// Wires the main nav's two dropdown <details> (Chart Types,
// Cross-Cutting Patterns) with the shared popover dismiss behavior --
// see details-dismiss.js for why this is shared rather than hand-wired
// per page.
import { makeDetailsDismissible } from "./details-dismiss.js";

document.querySelectorAll(".site-nav details").forEach(makeDetailsDismissible);
