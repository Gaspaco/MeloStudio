import { useNavigate } from "@solidjs/router";
import { createResource, lazy, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { getAppSession } from "~/lib/app-auth";

const Settings = lazy(() => import("~/pages/settings/Settings"));

export default function SettingsPage() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const appSession = await getAppSession();
    if (appSession) return appSession.data;
    navigate("/login", { replace: true });
    return null;
  });

  return (
    <Show when={session()} fallback={<RouteVeil label="Loading settings" />}>
      <Suspense fallback={<RouteVeil label="Loading settings" />}>
        <Settings />
      </Suspense>
    </Show>
  );
}
