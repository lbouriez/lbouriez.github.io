const switcher = document.querySelector(".switcher");
const tabs = Array.from(switcher.querySelectorAll("[data-mode]"));

switcher.setAttribute("role", "tablist");

for (const tab of tabs) {
  const mode = tab.dataset.mode;
  const panel = document.getElementById("panel-" + mode);

  tab.id = "tab-" + mode;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", panel.id);

  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tab.id);
  panel.tabIndex = 0;

  tab.addEventListener("click", (event) => {
    event.preventDefault();
    activateTab(tab, true);
  });
}

function activateTab(selectedTab, updateUrl) {
  const mode = selectedTab.dataset.mode;

  document.documentElement.dataset.mode = mode;
  for (const tab of tabs) {
    const isSelected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !isSelected;
  }

  for (const intro of document.querySelectorAll("[data-intro]")) {
    intro.hidden = intro.dataset.intro !== mode;
  }

  const hash = mode === "personnel" ? "#personnel" : "";
  if (updateUrl && location.hash !== hash) {
    const targetUrl = new URL(location.href);
    targetUrl.hash = hash;
    history.pushState(null, "", targetUrl);
  }
}

function syncFromLocation() {
  const personalHashes = ["#personnel", "#panel-personnel", "#creation", "#panel-creation"];
  const mode = personalHashes.includes(location.hash) ? "personnel" : "pro";
  const selectedTab = tabs.find((tab) => tab.dataset.mode === mode);
  const focusWasOnTab = tabs.includes(document.activeElement);
  activateTab(selectedTab, false);

  if (focusWasOnTab) {
    selectedTab.focus({ preventScroll: true });
  }
}

switcher.addEventListener("keydown", (event) => {
  const currentIndex = tabs.indexOf(event.target);
  if (currentIndex === -1) return;

  const nextIndex = {
    ArrowLeft: (currentIndex + tabs.length - 1) % tabs.length,
    ArrowRight: (currentIndex + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[event.key];

  if (nextIndex !== undefined) {
    event.preventDefault();
    tabs[nextIndex].focus();
    activateTab(tabs[nextIndex], true);
  } else if (event.key === " ") {
    event.preventDefault();
    activateTab(tabs[currentIndex], true);
  }
});

window.addEventListener("popstate", syncFromLocation);
window.addEventListener("hashchange", syncFromLocation);
syncFromLocation();
