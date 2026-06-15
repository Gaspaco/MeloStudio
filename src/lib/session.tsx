import { type Component, type JSX, createResource, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getAppSession } from "./app-auth";

// No result caching — stale-session-after-login/logout trap if we cache
export const getSession = () => getAppSession();

export const ProtectedPage: Component<{ label: string; children: JSX.Element }> = (props) => {
  const navigate = useNavigate();
  const [session] = createResource(getSession);

  // Redirect to login when session resolves to null
  const resolved = () => {
    const s = session();
    if (s === null) navigate("/login", { replace: true });
    return s;
  };

  return (
    <Show when={resolved()} fallback={<div class="route-veil" aria-label={`Loading ${props.label}...`} />}>
      {props.children}
    </Show>
  );
};
