import { type Component, createSignal, Show } from "solid-js";
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import Signup from "./pages/signup/Signup";

const App: Component = () => {
  const [page, setPage] = createSignal<"home" | "login" | "signup">("home");

  return (
    <>
      <Show when={page() === "home"}>
        <Home onLogin={() => setPage("login")} onSignup={() => setPage("signup")} />
      </Show>
      <Show when={page() === "login"}>
        <Login onBack={() => setPage("home")} onSignup={() => setPage("signup")} />
      </Show>
      <Show when={page() === "signup"}>
        <Signup onBack={() => setPage("home")} onLogin={() => setPage("login")} />
      </Show>
    </>
  );
};

export default App;
