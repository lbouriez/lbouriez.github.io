const switcher = document.querySelector(".switcher");
const tabs = Array.from(switcher.querySelectorAll("[data-mode]"), (link) => ({
  link,
  mode: link.dataset.mode,
  panel: document.getElementById(link.hash.slice(1)),
}));
const introductions = Array.from(document.querySelectorAll("[data-intro]"));
const personalHashes = new Set(["#personnel", "#panel-personnel", "#creation", "#panel-creation"]);
const swipeSurface = document.querySelector("main");
const swipeMinDistance = 60;
const swipeEdgeInset = 24;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let swipeStart;
let pageTurn;
let pageSlide;

function selectTab(activeTab) {
  const focused = document.activeElement;
  const focusWillBeHidden = tabs.some((tab) => tab !== activeTab && tab.panel.contains(focused)) ||
    introductions.some((intro) => intro.dataset.intro !== activeTab.mode && intro.contains(focused));

  document.documentElement.dataset.mode = activeTab.mode;

  for (const tab of tabs) {
    const selected = tab === activeTab;
    tab.link.setAttribute("aria-selected", String(selected));
    tab.link.tabIndex = selected ? 0 : -1;
    tab.panel.hidden = !selected;
  }

  for (const intro of introductions) {
    intro.setAttribute("aria-hidden", String(intro.dataset.intro !== activeTab.mode));
  }

  if (focused !== activeTab.link && (switcher.contains(focused) || focusWillBeHidden)) {
    activeTab.link.focus({ preventScroll: true });
  }
}

function updateTabLocation(tab) {
  selectTab(tab);

  const nextUrl = new URL(location.href);
  nextUrl.hash = tab.mode === "personnel" ? "#personnel" : "";
  if (nextUrl.href !== location.href) {
    history.pushState(null, "", nextUrl);
  }
}

function stopPageTurn() {
  if (pageTurn) {
    pageTurn.skipTransition();
    pageTurn = undefined;
    delete document.documentElement.dataset.pageTurn;
  }
  if (pageSlide) {
    pageSlide.cancel();
    pageSlide = undefined;
  }
}

function navigateToTab(tab, direction) {
  stopPageTurn();
  if (!direction || reducedMotion.matches) {
    updateTabLocation(tab);
    return;
  }

  if (!document.startViewTransition) {
    updateTabLocation(tab);
    const offset = direction === "left" ? 12 : -12;
    pageSlide = swipeSurface.animate?.(
      [{ transform: `translateX(${offset}px)`, opacity: 0.82 }, { transform: "none", opacity: 1 }],
      { duration: 240, easing: "ease-out" },
    );
    return;
  }

  const root = document.documentElement;
  root.dataset.pageTurn = direction;
  const transition = document.startViewTransition(() => {
    if (pageTurn === transition) updateTabLocation(tab);
  });
  pageTurn = transition;

  const clearPageTurn = () => {
    if (pageTurn !== transition) return;
    pageTurn = undefined;
    delete root.dataset.pageTurn;
  };
  // The browser can skip capturing the animation while still updating the tab.
  transition.ready.catch(() => {});
  transition.finished.then(clearPageTurn, clearPageTurn);
}

function syncFromLocation() {
  stopPageTurn();
  const mode = personalHashes.has(location.hash) ? "personnel" : "pro";
  selectTab(tabs.find((tab) => tab.mode === mode));
}

switcher.setAttribute("role", "tablist");

for (const tab of tabs) {
  const { link, mode, panel } = tab;
  link.id = "tab-" + mode;
  link.setAttribute("role", "tab");
  link.setAttribute("aria-controls", panel.id);

  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", link.id);
  panel.tabIndex = 0;

  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigateToTab(tab);
  });
}

switcher.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

  const currentIndex = tabs.findIndex((tab) => tab.link === event.target);
  if (currentIndex === -1) return;

  const destinationIndex = {
    ArrowLeft: (currentIndex + tabs.length - 1) % tabs.length,
    ArrowRight: (currentIndex + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
    " ": currentIndex,
  }[event.key];
  if (destinationIndex === undefined) return;

  event.preventDefault();
  navigateToTab(tabs[destinationIndex]);
});

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  swipeStart = undefined;
  if (!event.isPrimary || !swipeSurface.contains(event.target)) return;
  if (event.clientX < swipeEdgeInset || event.clientX > window.innerWidth - swipeEdgeInset) return;
  if (window.visualViewport?.scale > 1) return;

  swipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
}, { passive: true });

document.addEventListener("pointercancel", (event) => {
  if (event.pointerId === swipeStart?.pointerId) swipeStart = undefined;
}, { passive: true });

document.addEventListener("pointerup", (event) => {
  if (event.pointerId !== swipeStart?.pointerId) return;

  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = undefined;
  if (Math.abs(deltaX) < swipeMinDistance || Math.abs(deltaX) < 1.5 * Math.abs(deltaY)) return;

  const mode = deltaX < 0 ? "personnel" : "pro";
  if (mode !== document.documentElement.dataset.mode) {
    navigateToTab(tabs.find((tab) => tab.mode === mode), deltaX < 0 ? "left" : "right");
  }
}, { passive: true });

reducedMotion.addEventListener?.("change", () => {
  if (!reducedMotion.matches) return;
  // Finish any pending state update while skipping the visual effect.
  pageTurn?.skipTransition();
  pageSlide?.cancel();
});
window.addEventListener("hashchange", syncFromLocation);
syncFromLocation();
