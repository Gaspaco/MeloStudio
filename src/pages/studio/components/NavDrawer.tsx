import { type Component, For, Show, createSignal, createEffect } from "solid-js";
import type { Accessor, Setter } from "solid-js";

type NavCat = "project" | "edit" | "insert" | "view" | "transport" | "help";

export interface NavItem {
  label: string | (() => string);
  desc?: string | (() => string);
  kbd: string;
  action?: () => void;
  disabled?: () => boolean;
  tone?: "primary" | "danger";
}

export interface NavCategory {
  id: NavCat;
  num: string;
  label: string;
  ico: any;
  items: NavItem[];
}

interface NavDrawerProps {
  navCat:    Accessor<NavCat>;
  setNavCat: Setter<NavCat>;
  cats:      NavCategory[];
  name:      Accessor<string>;
  onClose:   () => void;
  onExit:    () => void;
}

const catIcons: Record<NavCat, () => any> = {
  project:   () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 3v14M3 8h4"/></svg>,
  edit:      () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z"/></svg>,
  insert:    () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4v12M4 10h12"/></svg>,
  view:      () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="3"/><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/></svg>,
  transport: () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="6,4 16,10 6,16"/></svg>,
  help:      () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M8 7.5a2.5 2.5 0 0 1 4 2c0 1.5-2 2-2 3M10 15v.5"/></svg>,
};

const NavDrawer: Component<NavDrawerProps> = (props) => {
  const activeCat = () => props.cats.find(c => c.id === props.navCat());
  const [subKey, setSubKey] = createSignal(0);

  createEffect(() => {
    props.navCat();
    setSubKey(k => k + 1);
  });

  return (
    <div class="bl__nav-backdrop" onClick={props.onClose}>
      <div class="bl__nav-menu" onClick={(e) => e.stopPropagation()}>
        {/* ── Left: categories ── */}
        <div class="bl__nav-cats">
          <For each={props.cats}>
            {(c) => (
              <button
                class={`bl__nav-cat ${props.navCat() === c.id ? "is-active" : ""}`}
                onMouseEnter={() => props.setNavCat(c.id)}
                onClick={() => props.setNavCat(c.id)}
              >
                <span class="bl__nav-cat-ico">{catIcons[c.id]()}</span>
                <span class="bl__nav-cat-label">{c.label}</span>
                <svg class="bl__nav-cat-chev" viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 2l4 4-4 4"/>
                </svg>
              </button>
            )}
          </For>

          <div class="bl__nav-divider" />

          <button class="bl__nav-cat" onClick={props.onExit}>
            <span class="bl__nav-cat-ico">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7"/>
                <path d="M14 7l-3 3 3 3M11 10h6"/>
              </svg>
            </span>
            <span class="bl__nav-cat-label">Exit</span>
          </button>
        </div>

        {/* ── Right: submenu items ── */}
        <Show when={activeCat()}>
          {(cat) => (
            <div class="bl__nav-sub" data-key={subKey()}>
              <For each={cat().items}>
                {(it, i) => {
                  const isDisabled = () => it.disabled?.() ?? !it.action;
                  const labelText = () => typeof it.label === "function" ? it.label() : it.label;
                  const descText = () => typeof it.desc === "function" ? it.desc() : it.desc;
                  return (
                    <button
                      class={`bl__nav-sub-item ${it.tone ? `is-${it.tone}` : ""}`}
                      style={{ "animation-delay": `${i() * 50}ms` }}
                      disabled={isDisabled()}
                      onClick={() => { if (!isDisabled()) { it.action?.(); props.onClose(); } }}
                    >
                      <span class="bl__nav-sub-copy">
                        <span class="bl__nav-sub-label">{labelText()}</span>
                        <Show when={descText()}>
                          {(desc) => <span class="bl__nav-sub-desc">{desc()}</span>}
                        </Show>
                      </span>
                      <Show when={it.kbd}>
                        <span class="bl__nav-sub-kbd">{it.kbd}</span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};

export default NavDrawer;
