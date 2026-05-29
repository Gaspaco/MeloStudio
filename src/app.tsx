import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import "./styles/global.scss";

export default function App() {
  return (
    <Router root={(props) => <Suspense fallback={<RouteVeil label="Loading" />}>{props.children}</Suspense>}>
      <FileRoutes />
    </Router>
  );
}
