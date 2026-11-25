const switcher = document.querySelector(".switcher");
const tabs = Array.from(switcher.querySelectorAll("[data-mode]"), (link) => ({
  link,
  mode: link.dataset.mode,
  panel: document.getElementById(link.hash.slice(1)),
}));
const introductions = document.querySelectorAll("[data-intro]");
const personalHashes = new Set(["#personnel", "#panel-personnel", "#creation", "#panel-creation"]);

function selectTab(activeTab) {
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
}

function navigateToTab(tab) {
  selectTab(tab);

  const nextUrl = new URL(location.href);
  nextUrl.hash = tab.mode === "personnel" ? "#personnel" : "";
  if (nextUrl.href !== location.href) {
    history.pushState(null, "", nextUrl);
  }
}

function syncFromLocation() {
  const mode = personalHashes.has(location.hash) ? "personnel" : "pro";
  const tab = tabs.find((item) => item.mode === mode);
  selectTab(tab);

  if (switcher.contains(document.activeElement)) {
    tab.link.focus({ preventScroll: true });
  }
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
  const destination = tabs[destinationIndex];
  destination.link.focus({ preventScroll: true });
  navigateToTab(destination);
});

window.addEventListener("hashchange", syncFromLocation);
syncFromLocation();
