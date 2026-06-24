import type { Component } from "solid-js";

// The one and only loading screen: a static MELO Studio logo on the dark
// background, matching the SSR boot veil (entry-server.tsx). Used as the
// Suspense fallback for route loads and client-side navigations.
const RouteVeil: Component<{ active?: boolean; label?: string }> = (props) => (
  <div
    class="route-veil"
    classList={{ "route-veil--active": props.active !== false }}
    aria-live="polite"
    aria-busy="true"
    aria-label={props.label ?? "Loading MeloStudio"}
  >
    <div class="route-veil__logo">
      <span class="route-veil__melo">MELO</span>
      <span class="route-veil__studio">Studio</span>
    </div>
  </div>
);

export default RouteVeil;
