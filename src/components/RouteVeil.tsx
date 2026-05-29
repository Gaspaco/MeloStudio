import type { Component } from "solid-js";

const RouteVeil: Component<{ active?: boolean; label?: string }> = (props) => (
  <div class="route-veil" classList={{ "route-veil--active": props.active !== false }} aria-live="polite" aria-busy="true">
    <div class="route-veil__mark">
      <span>Melo</span>
      <strong>Studio</strong>
    </div>
    <div class="route-veil__bar" />
    <span class="route-veil__label">{props.label ?? "Loading"}</span>
  </div>
);

export default RouteVeil;