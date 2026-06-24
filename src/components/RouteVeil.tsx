import type { Component } from "solid-js";
import Loader from "~/pages/home/sections/Loader";

const hasSeenLoader = () => {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem("melostudio_loaded") === "1"; }
  catch { return true; }
};

const RouteVeil: Component<{ active?: boolean; label?: string }> = (props) => {
  if (hasSeenLoader()) return null;
  return (
    <div class="route-veil" classList={{ "route-veil--active": props.active !== false }} aria-live="polite" aria-busy="true">
      <Loader />
    </div>
  );
};

export default RouteVeil;
