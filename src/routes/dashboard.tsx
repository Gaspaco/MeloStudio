import { useNavigate } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { createProjectApi } from "~/lib/api";
import { ProtectedPage } from "~/lib/session";

const Dashboard = lazy(() => import("~/pages/dashboard/Dashboard"));

export default function DashboardPage() {
  const navigate = useNavigate();

  const handleNewProject = async (name: string = "Untitled Project") => {
    try {
      const { id } = await createProjectApi(name);
      navigate(`/studio/${id}?new=1`);
    } catch (err) {
      console.error("Failed to create project", err);
      alert("Couldn't create project. Make sure you're signed in.");
    }
  };

  return (
    <ProtectedPage label="dashboard">
      <Suspense fallback={<RouteVeil label="Opening dashboard" />}>
        <Dashboard
          onLogout={() => navigate("/login", { replace: true })}
          onNewProject={handleNewProject}
          onOpenProject={(id) => navigate(`/studio/${id}`)}
        />
      </Suspense>
    </ProtectedPage>
  );
}
