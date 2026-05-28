import { useNavigate } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import Studio from "~/pages/studio/Studio";
import { getAppSession } from "~/lib/app-auth";

export default function StudioRoute() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const appSession = await getAppSession();
    if (appSession) return appSession.data;
    navigate("/login", { replace: true });
    return null;
  });

  return (
    <Show when={session()} fallback={null}>
      <Studio />
    </Show>
  );
}
