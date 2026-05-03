import { useNavigate } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import Dashboard from "~/pages/dashboard/Dashboard";
import { createProjectApi } from "~/lib/api";
import { authClient } from "~/lib/auth";

export default function DashboardPage() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      navigate("/login", { replace: true });
      return null;
    }
    return data;
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
    <Show when={session()} fallback={null}>
      <Dashboard
        onLogout={() => navigate("/login")}
        onNewProject={handleNewProject}
        onOpenProject={(id) => navigate(`/studio/${id}`)}
        onHome={() => navigate("/")}
      />
    </Show>
  );
}
