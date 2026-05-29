import { useNavigate } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import Dashboard from "~/pages/dashboard/Dashboard";
import { createProjectApi } from "~/lib/api";
import { getAppSession } from "~/lib/app-auth";

export default function DashboardPage() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const appSession = await getAppSession();
    if (appSession) return appSession.data;
    navigate("/login", { replace: true });
    return null;
  });

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
    <Show when={session()} fallback={<RouteVeil label="Opening dashboard" />}>
      <Dashboard
        onLogout={() => navigate("/login", { replace: true })}
        onNewProject={handleNewProject}
        onOpenProject={(id) => navigate(`/studio/${id}`)}
        onHome={() => navigate("/")}
      />
    </Show>
  );
}
