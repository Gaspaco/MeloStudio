// `[id]` is the dynamic project ID from URLs such as `/studio/abc123`.
// The Studio component reads that ID and loads the matching project.
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
