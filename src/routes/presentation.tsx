import { lazy } from "solid-js";

const Presentation = lazy(() => import("~/pages/presentation/Presentation"));

export default function TechPage() {
  return <Presentation />;
}
