import { useNavigate } from "@solidjs/router";
import Signup from "~/pages/signup/Signup";

export default function SignupPage() {
  const navigate = useNavigate();
  return (
    <Signup
      onBack={() => navigate("/")}
      onLogin={() => navigate("/login")}
      onSuccess={() => navigate("/dashboard")}
    />
  );
}
