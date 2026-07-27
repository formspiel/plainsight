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

  // Keyboard-driven dismiss: Tab/Shift+Tab moving focus somewhere
  // genuinely outside this details element. Deliberately does NOT treat
  // a missing relatedTarget (nextFocus falsy) as "left the details" --
  // Safari doesn't reliably focus a plain <a> on mouse click (a real,
  // documented difference from Chrome/Firefox), so clicking a link
  // INSIDE this dropdown could produce a focusout with relatedTarget:
  // null, which used to read as "focus left" and close the dropdown out
  // from under the very click trying to follow that link -- the links
  // were unclickable in Safari specifically because of this, not
  // anything about the links or dropdown positioning themselves. Only
  // close here when we positively know where focus went AND it's
  // outside; the click-outside listener below covers the rest.
  details.addEventListener("focusout", (event) => {
    const nextFocus = event.relatedTarget;
    if (nextFocus && !details.contains(nextFocus)) {
      details.open = false;
    }
  });

  // Pointer-driven dismiss: a real click landing outside this details
  // element, checked by click TARGET rather than focus state -- doesn't
  // depend on whether the clicked element did or didn't receive DOM
  // focus, so it isn't fooled by the Safari gap above. Also naturally
  // leaves clicks on the summary itself (toggling open/closed) alone,
  // since the summary is inside `details`.
  document.addEventListener("click", (event) => {
    if (details.open && !details.contains(event.target)) {
      details.open = false;
    }
  });
}
