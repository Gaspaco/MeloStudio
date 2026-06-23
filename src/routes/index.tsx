import { useNavigate } from "@solidjs/router";
import { lazy, onMount, Show, Suspense, createSignal } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { getAppSession } from "~/lib/app-auth";

const Home = lazy(() => import("~/pages/home/Home"));

export default function HomePage() {
  const navigate = useNavigate();
  const [canShowLanding, setCanShowLanding] = createSignal(false);

  onMount(async () => {
    try {
      const session = await getAppSession();
      if (session) {
        navigate("/dashboard", { replace: true });
        return;
      }
    } catch {
      // If the session check fails, fall back to the public landing page.
    }

    setCanShowLanding(true);
  });

  return (
    <Show when={canShowLanding()} fallback={<RouteVeil label="Checking session" />}>
      <Suspense fallback={<RouteVeil label="Loading" />}>
        <Home
          onLogin={() => navigate("/login")}
          onSignup={() => navigate("/signup")}
          onProfile={() => navigate("/dashboard")}
        />
      </Suspense>
    </Show>
  );
}
