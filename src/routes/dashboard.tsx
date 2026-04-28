import { useNavigate } from "@solidjs/router";
import Dashboard from "~/pages/dashboard/Dashboard";
import { createProjectApi } from "~/lib/api";

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
    <Dashboard
      onLogout={() => navigate("/login")}
      onNewProject={handleNewProject}
      onOpenProject={(id) => navigate(`/studio/${id}`)}
      onHome={() => navigate("/")}
    />
  );
}
