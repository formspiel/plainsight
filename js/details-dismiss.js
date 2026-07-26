/*
  Generic dismiss behavior for a <details> used as a popover trigger (a nav
  dropdown, a toolbar's disclosure button) -- not for a long-form disclosure
  like a "Long description" section, which is meant to stay open until the
  reader deliberately closes it.

  Native <details> gives a toggle-on-click/Enter/Space mechanic and an
  implicit expanded state for free, but not the two behaviors anyone used to
  menus/popovers expects on top of that: closing on Escape, and closing when
  focus moves elsewhere. This is shared (unlike this project's hand-wired
  per-chart accessibility code -- see CLAUDE.md) because it's generic DOM
  plumbing, not chart-specific ARIA/keyboard semantics being demonstrated.

  Tooltips are a deliberate exception and do NOT use this: they're
  hover/focus-driven sighted-only affordances, not something a keyboard user
  opens or needs to dismiss.
*/
export function makeDetailsDismissible(details) {
  if (!details) return;
  const summary = details.querySelector("summary");
  if (!summary) return;

  details.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && details.open) {
      details.open = false;
      summary.focus();
    }
  });

  details.addEventListener("focusout", (event) => {
    const nextFocus = event.relatedTarget;
    if (!nextFocus || !details.contains(nextFocus)) {
      details.open = false;
    }
  });
}
