// The library filters active and deleted projects for display. Rename, restore
// and delete operations are passed back to Dashboard, which owns the real data.
import { type Component, For, Show } from "solid-js";
import { type DeletedProjectListItem } from "../../../lib/api";
import { waveform } from "./waveform";
import "./library.scss";

interface Project {
  id: string;
  name: string;
  bpm: number;
  key: string;
  tracks: number;
  updatedAt: string;
  updatedAtRaw: string;
  color: string;
  published: boolean;
}

export interface LibraryProps {
  projects: () => Project[];
  userImage: () => string | undefined;
  libCat: () => "all" | "mine" | "liked" | "deleted";
  setLibCat: (v: "all" | "mine" | "liked" | "deleted") => void;
  libSearch: () => string;
  setLibSearch: (v: string) => void;
  tabRefs: Partial<Record<string, HTMLButtonElement>>;
  tabInd: () => { left: number; width: number; isTrash: boolean };
  menuProjectId: () => string | null;
  toggleMenu: (e: Event, id: string) => void;
  closeMenu: () => void;
  deletedProjects: () => DeletedProjectListItem[];
  deletedLoading: () => boolean;
  trashActionError: () => string;
  loadDeletedProjects: () => void;
  handleRestore: (item: DeletedProjectListItem) => void;
  setPermDeleteTarget: (item: DeletedProjectListItem | null) => void;
  setTrashActionError: (v: string) => void;
  daysLeft: (expiresAt: string) => number;
  openCreate: () => void;
  openRename: (e: Event, project: Project) => void;
  openDelete: (e: Event, project: Project) => void;
  onOpenProject: (id: string) => void;
}

const Library: Component<LibraryProps> = (props) => {
  const filtered = () =>
    props.projects().filter((p) =>
      p.name.toLowerCase().includes(props.libSearch().toLowerCase())
    );

  return (
    <div class="db__content db__content--library">

      <div class="db__lib-header">
        <div class="db__lib-header-top">
          <h1 class="db__lib-title">Library</h1>
          <div class="db__lib-header-actions">
            <div class="db__lib-search">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 3 3" /></svg>
              <input
                class="db__lib-search-input"
                type="text"
                placeholder="Search projects…"
                value={props.libSearch()}
                onInput={(e) => props.setLibSearch(e.currentTarget.value)}
              />
            </div>
            <button class="db__lib-new-btn" onClick={props.openCreate}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 4v12M4 10h12" /></svg>
              <span>New project</span>
            </button>
          </div>
        </div>
        <nav class="db__lib-tabs">
          <button
            ref={(el) => { props.tabRefs["all"] = el; }}
            class={`db__lib-tab${props.libCat() === "all" ? " db__lib-tab--active" : ""}`}
            onClick={() => props.setLibCat("all")}
          >
            All
            <span class="db__lib-tab-badge">{filtered().length}</span>
          </button>
          <button
            ref={(el) => { props.tabRefs["mine"] = el; }}
            class={`db__lib-tab${props.libCat() === "mine" ? " db__lib-tab--active" : ""}`}
            onClick={() => props.setLibCat("mine")}
          >
            Mine
          </button>
          <button
            ref={(el) => { props.tabRefs["liked"] = el; }}
            class={`db__lib-tab${props.libCat() === "liked" ? " db__lib-tab--active" : ""}`}
            onClick={() => props.setLibCat("liked")}
          >
            Liked
          </button>
          <span class="db__lib-tab-spacer">
            <span class="db__lib-tab-count">{filtered().length} projects</span>
          </span>
          <button
            ref={(el) => { props.tabRefs["deleted"] = el; }}
            class={`db__lib-tab db__lib-tab--trash${props.libCat() === "deleted" ? " db__lib-tab--active" : ""}`}
            onClick={() => { props.setLibCat("deleted"); props.loadDeletedProjects(); }}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 6h12M7 6V4h6v2M8 9v6m4-6v6M5 6l1 10h8l1-10" /></svg>
            Trash
          </button>
          <div
            class="db__lib-tab-indicator"
            style={{
              left: `${props.tabInd().left}px`,
              width: `${props.tabInd().width}px`,
              ...(props.tabInd().isTrash ? { background: "#ff5454" } : {}),
            }}
          />
        </nav>
      </div>

      <div class="db__lib-body" onClick={() => props.menuProjectId() && props.closeMenu()}>
        <Show when={props.libCat() === "all" || props.libCat() === "mine"}>
          <Show when={filtered().length === 0}>
            <div class="db__lib-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
              <span>No projects yet</span>
              <button class="db__lib-empty-cta" onClick={props.openCreate}>Create your first project</button>
            </div>
          </Show>
          <div class="db__lib-grid">
            <For each={filtered()}>{(project) =>
              <div
                class="db__album"
                style={{ "--ac": project.color || "#e05297" } as any}
                onClick={() => { if (!props.menuProjectId()) props.onOpenProject(project.id); }}
              >
                <div class="db__album-cover">
                  <Show when={props.userImage()} keyed fallback={
                    <svg class="db__album-wave" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <For each={waveform(project.id, 24)}>{(h, i) =>
                        <rect x={i() * 4.2} y={50 - h} width="2.5" height={h * 2} rx="1.25" fill="rgba(255,255,255,0.15)" />
                      }</For>
                    </svg>
                  }>
                    {(src) => <img class="db__album-cover-img" src={src} alt="" />}
                  </Show>
                  <span class="db__album-play">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                  <div class="db__album-menu-wrap">
                    <button class="db__album-dots" onClick={(e) => { e.stopPropagation(); props.toggleMenu(e, project.id); }}>
                      <svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" /></svg>
                    </button>
                    <Show when={props.menuProjectId() === project.id}>
                      <div class="db__album-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button class="db__album-dd-item" onClick={() => { props.closeMenu(); props.onOpenProject(project.id); }}>Open</button>
                        <button class="db__album-dd-item" onClick={(e) => { props.closeMenu(); props.openRename(e, project); }}>Rename</button>
                        <button class="db__album-dd-item db__album-dd-item--danger" onClick={(e) => { props.closeMenu(); props.openDelete(e, project); }}>Delete</button>
                      </div>
                    </Show>
                  </div>
                </div>
                <div class="db__album-info">
                  <span class="db__album-name">{project.name}</span>
                  <span class="db__album-meta">{project.bpm || 100} BPM · {project.tracks || 1} track{(project.tracks || 1) !== 1 ? "s" : ""}</span>
                </div>
              </div>
            }</For>
          </div>
        </Show>

        <Show when={props.libCat() === "liked"}>
          <div class="db__lib-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span>No liked projects yet</span>
          </div>
        </Show>

        <Show when={props.libCat() === "deleted"}>
          <Show when={props.deletedLoading()}>
            <div class="db__lib-empty"><span>Loading trash...</span></div>
          </Show>
          <Show when={!props.deletedLoading() && props.deletedProjects().length === 0}>
            <div class="db__lib-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
              <span>Trash is empty</span>
            </div>
          </Show>
          <Show when={!props.deletedLoading() && props.deletedProjects().length > 0}>
            <div class="db__lib-trash-note">
              Projects are automatically deleted after <strong>10 days</strong> in trash.
            </div>
            <For each={props.deletedProjects()}>{(item) =>
              <div class="db__lib-row db__lib-row--deleted" style={{ "--proj-color": "#888" } as any}>
                <div class="db__lib-row-thumb db__lib-row-thumb--deleted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </div>
                <div class="db__lib-row-info">
                  <span class="db__lib-row-name">{item.name}</span>
                  <span class="db__lib-row-meta">{item.bpm} BPM • {item.trackCount} track{item.trackCount !== 1 ? "s" : ""}</span>
                </div>
                <span class="db__lib-row-expiry">{props.daysLeft(item.expiresAt)}d left</span>
                <div class="db__lib-row-trash-acts">
                  <button class="db__lib-row-btn" onClick={() => props.handleRestore(item)}>Restore</button>
                  <button class="db__lib-row-btn db__lib-row-btn--danger" onClick={() => { props.setPermDeleteTarget(item); props.setTrashActionError(""); }}>Delete Forever</button>
                </div>
              </div>
            }</For>
            <Show when={props.trashActionError()}>
              <span class="db__lib-trash-err">{props.trashActionError()}</span>
            </Show>
          </Show>
        </Show>
      </div>

    </div>
  );
};

export default Library;
