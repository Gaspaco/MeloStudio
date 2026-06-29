// Keep the token in the URL so ResetPassword can read it.
import { useNavigate } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";

const ResetPassword = lazy(() => import("~/pages/reset-password/ResetPassword"));

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<RouteVeil label="Loading" />}>
      <ResetPassword
        onBack={() => navigate("/login")}
        onSuccess={() => navigate("/login")}
      />
    </Suspense>
  );
}
