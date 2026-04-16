import { useNavigate } from "@solidjs/router";
import Dashboard from "~/pages/dashboard/Dashboard";

export default function DashboardPage() {
  const navigate = useNavigate();
  return (
    <Dashboard
      onLogout={() => navigate("/login")}
      onNewProject={() => {}}
      onHome={() => navigate("/")}
    />
  );
}
