import { useNavigate } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import Studio from "~/pages/studio/Studio";
import { authClient } from "~/lib/auth";
import { socialAuthClient } from "~/lib/social-auth";

export default function StudioRoute() {
  const navigate = useNavigate();

  const [session] = createResource(async () => {
    const { data } = await authClient.getSession();
    if (data?.user) return data;
    const { data: baData } = await socialAuthClient.getSession();
    if (baData?.user) return baData;
    navigate("/login", { replace: true });
    return null;
  });

  return (
    <Show when={session()} fallback={null}>
      <Studio />
    </Show>
  );
}
