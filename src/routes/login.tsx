import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import Login from "~/pages/login/Login";

export default function LoginPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = createSignal(false);

  const finishLogin = () => {
    setLeaving(true);
    window.setTimeout(() => navigate("/dashboard", { replace: true }), 260);
  };

  return (
    <>
      <Login
        onBack={() => navigate("/")}
        onSignup={() => navigate("/signup")}
        onForgot={() => navigate("/forgot")}
        onSuccess={finishLogin}
      />
      <Show when={leaving()}>
        <RouteVeil label="Opening dashboard" />
      </Show>
    </>
  );
}
