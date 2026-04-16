import { useNavigate } from "@solidjs/router";
import ForgotPassword from "~/pages/forgot/ForgotPassword";

export default function ForgotPage() {
  const navigate = useNavigate();
  return (
    <ForgotPassword
      onBack={() => navigate("/login")}
      onLogin={() => navigate("/login")}
    />
  );
}
