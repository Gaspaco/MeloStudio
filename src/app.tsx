import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, createSignal, onCleanup, onMount, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { waitForVisualReady } from "~/lib/client/visualReady";
import { installI18n } from "~/lib/i18n";
import "./styles/global.scss";

let bootSignaled = false;
function applyStoredTheme() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const theme = window.localStorage.getItem("ms_theme") ?? "dark";
  if (theme === "system") {
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    document.documentElement.setAttribute("data-theme", prefersLight ? "light" : "dark");
    return;
  }

  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
}

applyStoredTheme();

function BootReady() {
  onMount(() => {
    if (bootSignaled || typeof document === "undefined") return;
    bootSignaled = true;
    document.dispatchEvent(new Event("app:content-ready"));
  });
  return null;
}

function NavigationVeil() {
  const location = useLocation();
  const [active, setActive] = createSignal(false);
  let firstRun = true;
  let routeToken = 0;
  let hideTimer: number | undefined;

  createEffect(() => {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    if (typeof window === "undefined") return;
    // Bare expression read — required to register `routeKey` as a reactive dependency so SolidJS re-runs this effect on URL changes
    routeKey;

    if (firstRun) {
      firstRun = false;
      return;
    }

    const token = ++routeToken;
    const startedAt = performance.now();
    setActive(true);
    if (hideTimer) window.clearTimeout(hideTimer);

    void waitForVisualReady({ frames: 2, stylesheetsMaxWait: 1200, totalMaxWait: 1600 }).then(() => {
      if (token !== routeToken) return;
      const elapsed = performance.now() - startedAt;
      const minVisible = 180;
      hideTimer = window.setTimeout(() => {
        if (token === routeToken) setActive(false);
        document.dispatchEvent(new Event("app:content-ready"));
      }, Math.max(0, minVisible - elapsed));
    });
  });

  onCleanup(() => {
    routeToken += 1;
    if (hideTimer) window.clearTimeout(hideTimer);
  });

  return (
    <Show when={active()}>
      <RouteVeil label="Loading page" />
    </Show>
  );
}

function AppRoot(props: { children?: any }) {
  onMount(() => {
    applyStoredTheme();
    const cleanupI18n = installI18n();
    onCleanup(cleanupI18n);
  });

  return (
    <>
      <Suspense fallback={<RouteVeil label="Loading page" />}>
        {props.children}
        <BootReady />
      </Suspense>
      <NavigationVeil />
    </>
  );
}

export default function App() {
  return (
    <Router root={AppRoot}>
      <FileRoutes />
    </Router>
  );
}
