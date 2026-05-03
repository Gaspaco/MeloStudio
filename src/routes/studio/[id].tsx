import { useNavigate } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import Studio from "~/pages/studio/Studio";
import { authClient } from "~/lib/auth";

export default function StudioRoute() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      navigate("/login", { replace: true });
      return null;
    }
    return data;
  });

  return (
    <Show when={session()} fallback={null}>
      <Studio />
    </Show>
  );
}
