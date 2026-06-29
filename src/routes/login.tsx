import { useNavigate } from "@solidjs/router";
import { createSignal, lazy, Show, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";

const Login = lazy(() => import("~/pages/login/Login"));

export default function LoginPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = createSignal(false);

  const finishLogin = () => {
    setLeaving(true);
    // Let the veil cover the page before switching routes.
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
