import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./styles/global.scss";

function PageLoader() {
  return (
    <div style={{
      position: "fixed", inset: "0",
      display: "flex", "align-items": "center", "justify-content": "center",
      background: "var(--bg-primary, #0a0a0a)",
    }} />
  );
}

export default function App() {
  return (
    <Router root={(props) => <Suspense fallback={<PageLoader />}>{props.children}</Suspense>}>
      <FileRoutes />
    </Router>
  );
}
