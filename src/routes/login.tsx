// This route lazy-loads the login UI and owns the transition to the dashboard.
import { useNavigate } from "@solidjs/router";
import { createSignal, lazy, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";

const Login = lazy(() => import("~/pages/login/Login"));

export default function LoginPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = createSignal(false);

  const finishLogin = () => {
    setLeaving(true);
    // Give the route veil time to cover the old page before navigation swaps it.
    window.setTimeout(() => navigate("/dashboard", { replace: true }), 260);
  };

  return (
    <>
      <Suspense fallback={<RouteVeil label="Loading" />}>
        <Login
          onSignup={() => navigate("/signup")}
          onForgot={() => navigate("/forgot")}
          onSuccess={finishLogin}
        />
      </Suspense>
      <Show when={leaving()}>
        <RouteVeil label="Opening dashboard" />
      </Show>
    </>
  );
}
