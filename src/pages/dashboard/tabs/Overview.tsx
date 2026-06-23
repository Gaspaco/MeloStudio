import { type Component, For, Show, onMount, onCleanup } from "solid-js";
import "./overview.scss";

interface Project {
  id: string;
  name: string;
  bpm: number;
  key: string;
  tracks: number;
  updatedAt: string;
  color: string;
}

export interface OverviewProps {
  projects: () => Project[];
  userImage: () => string | undefined;
  loadingProjects: () => boolean;
  greeting: () => string;
  firstName: () => string;
  totalTracks: () => number;
  studioHours: () => number;
  fmtStudioTime: () => string;
  openCreate: () => void;
  openRename: (e: Event, project: Project) => void;
  openDelete: (e: Event, project: Project) => void;
  onOpenProject: (id: string) => void;
  switchTab: (tab: "overview" | "library" | "profile") => void;
}

const Overview: Component<OverviewProps> = (props) => {
  return (
    <div class="db__content">

      <section class="db__hero">
        <div class="db__hero-greeting">
          <span class="db__hero-script">{props.greeting()},</span>
        </div>
        <div class="db__hero-clip">
          <For each={props.firstName().split("")}>
            {(ch) => <span class="db__hero-char">{ch === " " ? " " : ch}</span>}
          </For>
        </div>
      </section>

      <section class="db__stats">
        <div class="db__stat">
          <span class="db__stat-num">{props.projects().length}</span>
          <span class="db__stat-label">Projects</span>
          <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `${Math.min(props.projects().length * 10, 100)}%` }} /></span>
        </div>
        <div class="db__stat">
          <span class="db__stat-num">{props.totalTracks()}</span>
          <span class="db__stat-label">Tracks</span>
          <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `${Math.min(props.totalTracks() * 5, 100)}%` }} /></span>
        </div>
        <div class="db__stat">
          <span class="db__stat-num">{props.fmtStudioTime()}</span>
          <span class="db__stat-label">Studio Time</span>
          <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: `${Math.min(props.studioHours() * 10, 100)}%` }} /></span>
        </div>
        <div class="db__stat">
          <span class="db__stat-num">0</span>
          <span class="db__stat-label">Templates</span>
          <span class="db__stat-bar"><span class="db__stat-fill" style={{ width: "0%" }} /></span>
        </div>
      </section>

      <div class="db__rule" />

      <section class="db__section">
        <div class="db__section-header">
          <span class="db__section-idx">01</span>
          <h2 class="db__section-title">Projects</h2>
          <button class="db__section-action" onClick={props.openCreate} title="New project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v16m8-8H4" /></svg>
            <span>New project</span>
          </button>
        </div>
        <Show when={!props.loadingProjects()} fallback={
          <div class="db__skeletons">
            {[1, 2, 3].map(() => <div class="db__skeleton-row" />)}
          </div>
        }>
          <Show when={props.projects().length > 0} fallback={
            <div class="db__empty">
              <div class="db__empty-glow" />
              <span class="db__empty-note">♪</span>
              <h3 class="db__empty-title">Nothing here yet</h3>
              <p class="db__empty-sub">Create your first project and start making music.</p>
              <button class="db__empty-cta" onClick={props.openCreate}>
                <span>Start creating</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
              </button>
            </div>
          }>
            <div class="db__proj-list">
              <For each={props.projects()}>{(project) =>
                <div class="db__proj" style={{ "--pc": project.color } as any} onClick={() => props.onOpenProject(project.id)}>
                  <div class="db__proj-thumb">
                    <Show when={props.userImage()} keyed fallback={
                      <span class="db__proj-thumb-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
                      </span>
                    }>
                      {(src) => <img class="db__proj-thumb-img" src={src} alt="" />}
                    </Show>
                  </div>
                  <div class="db__proj-info">
                    <span class="db__proj-name">{project.name}</span>
                    <span class="db__proj-meta">{project.bpm || 100} BPM · {project.tracks || 1} track{(project.tracks || 1) !== 1 ? "s" : ""}</span>
                  </div>
                  <span class="db__proj-date">{project.updatedAt}</span>
                  <div class="db__proj-acts">
                    <button class="db__proj-btn" onClick={(e) => { e.stopPropagation(); props.openRename(e, project); }} title="Rename">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2l5 5-9 9H2v-5z" /></svg>
                    </button>
                    <button class="db__proj-btn db__proj-btn--danger" onClick={(e) => { e.stopPropagation(); props.openDelete(e, project); }} title="Delete">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 8v5M10 8v5M3 4l1 10h8l1-10" /></svg>
                    </button>
                  </div>
                </div>
              }</For>
            </div>
          </Show>
        </Show>
      </section>

      {(() => {
        let canvasRef: HTMLCanvasElement | undefined;
        let raf = 0;
        let running = false;
        let mouseX = -1;
        let sized = false;
        let points = new Float64Array(0);
        let pointCount = 0;

        const ensureSize = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => {
          if (sized) return;
          canvasRef!.width = w * dpr;
          canvasRef!.height = h * dpr;
          ctx.scale(dpr, dpr);
          pointCount = Math.ceil(w / 3);
          points = new Float64Array(pointCount);
          sized = true;
        };

        const pt = (i: number): number => points[i] ?? 0;

        const draw = () => {
          if (!canvasRef) return;
          const ctx = canvasRef.getContext("2d")!;
          const rect = canvasRef.getBoundingClientRect();
          const w = rect.width, h = rect.height;
          ensureSize(ctx, w, h, window.devicePixelRatio || 1);

          const mid = h / 2;
          const step = w / pointCount;

          if (mouseX >= 0) {
            const mi = Math.floor(mouseX / step);
            const radius = 18;
            for (let j = -radius; j <= radius; j++) {
              const idx = mi + j;
              if (idx < 0 || idx >= pointCount) continue;
              const dist = Math.abs(j) / radius;
              const push = (1 - dist * dist) * 12;
              const dir = j < 0 ? -1 : j > 0 ? 1 : 0;
              points[idx] = pt(idx) + push * (dir * 0.5 + (Math.random() - 0.5) * 0.2);
            }
          }

          let settled = true;
          for (let i = 0; i < pointCount; i++) {
            points[i] = pt(i) * 0.93;
            if (i > 0) points[i] = pt(i) + (pt(i - 1) - pt(i)) * 0.22;
            if (i < pointCount - 1) points[i] = pt(i) + (pt(i + 1) - pt(i)) * 0.22;
            points[i] = Math.max(-30, Math.min(30, pt(i)));
            if (Math.abs(pt(i)) > 0.05) settled = false;
          }

          ctx.clearRect(0, 0, w, h);

          ctx.beginPath();
          ctx.moveTo(0, mid + pt(0));
          for (let i = 1; i < pointCount; i++) {
            const px = (i - 1) * step;
            const cx = i * step;
            const mx = (px + cx) / 2;
            ctx.quadraticCurveTo(px, mid + pt(i - 1), mx, mid + (pt(i - 1) + pt(i)) / 2);
          }
          ctx.lineTo(w, mid + pt(pointCount - 1));
          ctx.strokeStyle = "rgba(224, 82, 151, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, mid + pt(0) * 0.4);
          for (let i = 1; i < pointCount; i++) {
            const px = (i - 1) * step;
            const cx = i * step;
            const mx = (px + cx) / 2;
            const py = pt(i - 1) * 0.4;
            const ny = pt(i) * 0.4;
            ctx.quadraticCurveTo(px, mid + py, mx, mid + (py + ny) / 2);
          }
          ctx.lineTo(w, mid + pt(pointCount - 1) * 0.4);
          ctx.strokeStyle = "rgba(224, 82, 151, 0.12)";
          ctx.lineWidth = 1;
          ctx.stroke();

          if (settled && mouseX < 0) {
            ctx.clearRect(0, 0, w, h);
            ctx.beginPath();
            ctx.moveTo(0, mid);
            ctx.lineTo(w, mid);
            ctx.strokeStyle = "rgba(224, 82, 151, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            running = false;
            return;
          }
          raf = requestAnimationFrame(draw);
        };

        const startLoop = () => {
          if (running) return;
          running = true;
          raf = requestAnimationFrame(draw);
        };

        onMount(() => {
          if (!canvasRef) return;
          const ctx = canvasRef.getContext("2d")!;
          const rect = canvasRef.getBoundingClientRect();
          ensureSize(ctx, rect.width, rect.height, window.devicePixelRatio || 1);
          ctx.beginPath();
          ctx.moveTo(0, rect.height / 2);
          ctx.lineTo(rect.width, rect.height / 2);
          ctx.strokeStyle = "rgba(224, 82, 151, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
        onCleanup(() => cancelAnimationFrame(raf));

        return (
          <canvas
            ref={(el) => { canvasRef = el; }}
            class="db__wave-divider"
            onMouseMove={(e) => {
              mouseX = e.clientX - canvasRef!.getBoundingClientRect().left;
              startLoop();
            }}
            onMouseLeave={() => { mouseX = -1; }}
          />
        );
      })()}

      <section class="db__section">
        <div class="db__section-header">
          <span class="db__section-idx">02</span>
          <h2 class="db__section-title">Quick Actions</h2>
        </div>
        <div class="db__qa">
          <button class="db__qa-card" style={{ "--qa-c": "#7c5cff" } as any}>
            <div class="db__qa-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <span class="db__qa-label">Import Audio</span>
            <span class="db__qa-desc">Stems, samples, or full tracks</span>
            <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
          <button class="db__qa-card" style={{ "--qa-c": "#e05297" } as any}>
            <div class="db__qa-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
            </div>
            <span class="db__qa-label">Browse Templates</span>
            <span class="db__qa-desc">Pick a genre and build on it</span>
            <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
          <button class="db__qa-card" style={{ "--qa-c": "#14f195" } as any}>
            <div class="db__qa-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM12 18.5V22M8 22h8" /><circle cx="12" cy="12" r="2.5" /></svg>
            </div>
            <span class="db__qa-label">AI Master</span>
            <span class="db__qa-desc">Auto-master a track in seconds</span>
            <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
          <button class="db__qa-card" style={{ "--qa-c": "#00d2ff" } as any}>
            <div class="db__qa-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
            </div>
            <span class="db__qa-label">Collaborate</span>
            <span class="db__qa-desc">Invite someone to your session</span>
            <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
          <button class="db__qa-card" style={{ "--qa-c": "#ffaa00" } as any}>
            <div class="db__qa-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 0l4-4m0 0l-4-4m4 4H7" /></svg>
            </div>
            <span class="db__qa-label">Export</span>
            <span class="db__qa-desc">WAV, MP3, or stems bundle</span>
            <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
          <button class="db__qa-card" onClick={() => props.switchTab("profile")} style={{ "--qa-c": "#ff5454" } as any}>
            <div class="db__qa-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <span class="db__qa-label">Settings</span>
            <span class="db__qa-desc">Account, audio prefs, shortcuts</span>
            <svg class="db__qa-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
        </div>
      </section>

    </div>
  );
};

export default Overview;
