import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import Signup from "~/pages/signup/Signup";

export default function SignupPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = createSignal(false);

  const finishSignup = () => {
    setLeaving(true);
    window.setTimeout(() => navigate("/dashboard", { replace: true }), 260);
  };

  return (
    <>
      <Signup
        onBack={() => navigate("/")}
        onLogin={(email) => navigate(email ? `/login?email=${encodeURIComponent(email)}` : "/login")}
        onSuccess={finishSignup}
      />
      <Show when={leaving()}>
        <RouteVeil label="Creating studio" />
      </Show>
    </>
  );
}
