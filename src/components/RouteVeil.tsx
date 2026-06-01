import type { Component } from "solid-js";

const RouteVeil: Component<{ active?: boolean; label?: string }> = (props) => (
  <div class="route-veil" classList={{ "route-veil--active": props.active !== false }} aria-live="polite" aria-busy="true">
  </div>
);

export default RouteVeil;