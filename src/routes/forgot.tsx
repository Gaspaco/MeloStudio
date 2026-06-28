// The route supplies navigation while ForgotPassword owns the recovery form.
import { useNavigate } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";

const ForgotPassword = lazy(() => import("~/pages/forgot/ForgotPassword"));

export default function ForgotPage() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<RouteVeil label="Loading" />}>
      <ForgotPassword
        onBack={() => navigate("/login")}
        onLogin={() => navigate("/login")}
      />
    </Suspense>
  );
}
