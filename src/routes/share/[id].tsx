import { type Component, createResource, Show, For } from "solid-js";
import { useParams } from "@solidjs/router";

interface PublicProject {
  id: string;
  name: string;
  bpm: number;
  key: string;
  trackCount: number;
}

async function fetchPublicProject(id: string): Promise<PublicProject | null> {
  const res = await fetch(`/api/share/${id}`);
  if (!res.ok) return null;
  return res.json();
}

const SharePage: Component = () => {
  const params = useParams<{ id: string }>();
  const [project] = createResource(() => params.id, fetchPublicProject);

  return (
    <div style={{
      "min-height": "100svh",
      background: "#0a0a0f",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      padding: "2rem",
      "font-family": "system-ui, sans-serif",
      color: "#fff",
    }}>
      <Show when={project.loading}>
        <p style={{ color: "rgba(255,255,255,0.4)", "font-size": "0.9rem" }}>Loading…</p>
      </Show>

      <Show when={!project.loading && !project()}>
        <div style={{ "text-align": "center" }}>
          <p style={{ "font-size": "2rem", margin: "0 0 0.5rem" }}>🎵</p>
          <h2 style={{ margin: "0 0 0.5rem", "font-size": "1.1rem" }}>Project not found</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", "font-size": "0.85rem", margin: "0 0 1.5rem" }}>
            This project may not be published or the link is invalid.
          </p>
          <a href="/" style={{ color: "#e05297", "text-decoration": "none", "font-size": "0.85rem" }}>
            ← Go to MeloStudio
          </a>
        </div>
      </Show>

      <Show when={project()}>
        {(p) => (
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            "border-radius": "1.2rem",
            padding: "2.5rem 3rem",
            width: "min(28rem, 100%)",
            "box-shadow": "0 30px 80px rgba(0,0,0,0.6)",
          }}>
            <div style={{ "text-align": "center", "margin-bottom": "2rem" }}>
              <div style={{ "font-size": "2.5rem", "margin-bottom": "0.5rem" }}>🎵</div>
              <h1 style={{ margin: "0 0 0.3rem", "font-size": "1.5rem", "font-weight": "700" }}>
                {p().name}
              </h1>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", "font-size": "0.8rem" }}>
                Made with MeloStudio
              </p>
            </div>

            <div style={{
              display: "grid",
              "grid-template-columns": "1fr 1fr 1fr",
              gap: "1rem",
              "margin-bottom": "2rem",
            }}>
              <For each={[
                { label: "BPM", value: String(p().bpm) },
                { label: "Key", value: p().key || "—" },
                { label: "Tracks", value: String(p().trackCount) },
              ]}>
                {(stat) => (
                  <div style={{
                    background: "rgba(255,255,255,0.05)",
                    "border-radius": "0.7rem",
                    padding: "0.8rem",
                    "text-align": "center",
                  }}>
                    <div style={{ "font-size": "1.1rem", "font-weight": "700" }}>{stat.value}</div>
                    <div style={{ "font-size": "0.65rem", color: "rgba(255,255,255,0.4)", "text-transform": "uppercase", "letter-spacing": "0.1em" }}>{stat.label}</div>
                  </div>
                )}
              </For>
            </div>

            <a href="/" style={{
              display: "block",
              "text-align": "center",
              "text-decoration": "none",
              color: "#e05297",
              "font-size": "0.82rem",
              opacity: "0.7",
            }}>
              Create your own at MeloStudio →
            </a>
          </div>
        )}
      </Show>
    </div>
  );
};

export default SharePage;
