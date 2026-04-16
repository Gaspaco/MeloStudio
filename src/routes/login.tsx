import { useNavigate } from "@solidjs/router";
import Login from "~/pages/login/Login";

export default function LoginPage() {
  const navigate = useNavigate();
  return (
    <Login
      onBack={() => navigate("/")}
      onSignup={() => navigate("/signup")}
      onForgot={() => navigate("/forgot")}
      onSuccess={() => navigate("/dashboard")}
    />
  );
}
