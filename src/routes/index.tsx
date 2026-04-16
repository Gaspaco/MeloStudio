import { useNavigate } from "@solidjs/router";
import Home from "~/pages/home/Home";

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <Home
      onLogin={() => navigate("/login")}
      onSignup={() => navigate("/signup")}
      onProfile={() => navigate("/dashboard")}
    />
  );
}
