import { useNavigate } from "@solidjs/router";
import Dashboard from "~/pages/dashboard/Dashboard";
import { createProjectApi } from "~/lib/api";

export default function DashboardPage() {
  const navigate = useNavigate();

  const handleNewProject = async () => {
    try {
      const { id } = await createProjectApi();
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
      onHome={() => navigate("/")}
    />
  );
}
