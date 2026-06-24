import { useNavigate } from "@solidjs/router";
import { lazy, onMount, Show, Suspense, createSignal } from "solid-js";
import { getAppSession } from "~/lib/app-auth";

const Home = lazy(() => import("~/pages/home/Home"));

// Plain black cover (no animated logo) for the home route's loading states. The
// landing page has its own GSAP splash, so an animated veil here would make the
// intro appear, vanish, then replay. This just holds black until Home animates.
const HomeVeil = () => <div class="route-veil route-veil--active" aria-hidden="true" />;

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
    <Show when={canShowLanding()} fallback={<HomeVeil />}>
      <Suspense fallback={<HomeVeil />}>
        <Home
          onLogin={() => navigate("/login")}
          onSignup={() => navigate("/signup")}
          onProfile={() => navigate("/dashboard")}
        />
      </Suspense>
    </Show>
  );
}
