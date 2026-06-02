import { useNavigate } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";

const Home = lazy(() => import("~/pages/home/Home"));

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<RouteVeil label="Loading" />}>
      <Home
        onLogin={() => navigate("/login")}
        onSignup={() => navigate("/signup")}
        onProfile={() => navigate("/dashboard")}
      />
    </Suspense>
  );
}
