import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { ProtectedPage } from "~/lib/session";

const Settings = lazy(() => import("~/pages/settings/Settings"));

export default function SettingsPage() {
  return (
    <ProtectedPage label="settings">
      <Suspense fallback={<RouteVeil label="Loading settings" />}>
        <Settings />
      </Suspense>
    </ProtectedPage>
  );
}
