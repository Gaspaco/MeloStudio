import { useNavigate } from "@solidjs/router";
import { createResource, lazy, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { getAppSession } from "~/lib/app-auth";

const Studio = lazy(() => import("~/pages/studio/Studio"));

export default function StudioRoute() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const appSession = await getAppSession();
    if (appSession) return appSession.data;
    navigate("/login", { replace: true });
    return null;
  });

  return (
    <Show when={session()} fallback={<RouteVeil label="Opening studio" />}>
      <Suspense fallback={<RouteVeil label="Opening studio" />}>
        <Studio />
      </Suspense>
    </Show>
  );
}
