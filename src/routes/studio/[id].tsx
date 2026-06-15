import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { ProtectedPage } from "~/lib/session";

const Studio = lazy(() => import("~/pages/studio/Studio"));

export default function StudioRoute() {
  return (
    <ProtectedPage label="studio">
      <Suspense fallback={<RouteVeil label="Opening studio" />}>
        <Studio />
      </Suspense>
    </ProtectedPage>
  );
}
