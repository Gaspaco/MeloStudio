import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, createSignal, onCleanup, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { waitForVisualReady } from "~/lib/client/visualReady";
import "./styles/global.scss";

function NavigationVeil() {
  const location = useLocation();
  const [active, setActive] = createSignal(false);
  let firstRun = true;
  let routeToken = 0;
  let hideTimer: number | undefined;

  createEffect(() => {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    if (typeof window === "undefined") return;
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
  return (
    <>
      <Suspense fallback={<RouteVeil label="Loading page" />}>
        {props.children}
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
