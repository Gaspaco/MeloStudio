import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { onCleanup, onMount, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
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
