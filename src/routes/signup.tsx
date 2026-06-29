import { useNavigate } from "@solidjs/router";
import { createSignal, lazy, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";

const Signup = lazy(() => import("~/pages/signup/Signup"));

export default function SignupPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = createSignal(false);

  const finishSignup = () => {
    setLeaving(true);
    // Let the veil cover the page before switching routes.
    window.setTimeout(() => navigate("/dashboard", { replace: true }), 260);
  };

  return (
    <>
      <Suspense fallback={<RouteVeil label="Loading" />}>
        <Signup
          onLogin={(email) => navigate(email ? `/login?email=${encodeURIComponent(email)}` : "/login")}
          onSuccess={finishSignup}
        />
      </Suspense>
      <Show when={leaving()}>
        <RouteVeil label="Creating studio" />
      </Show>
    </>
  );
}
