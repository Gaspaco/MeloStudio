import { type Component, For, Show } from "solid-js";
import type { Accessor, Setter } from "solid-js";

type NavCat = "project" | "edit" | "insert" | "view" | "transport" | "help";

export interface NavItem {
  label: string | (() => string);
  kbd: string;
  action?: () => void;
  disabled?: () => boolean;
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

const NavDrawer: Component<NavDrawerProps> = (props) => {
  return (
    <div class="bl__nav-overlay" onClick={props.onClose}>
      <aside class="bl__nav-drawer" onClick={(e) => e.stopPropagation()}>
        <div class="bl__nav-header">
          <span class="bl__nav-eyebrow">— Menu</span>
          <button class="bl__nav-x" onClick={props.onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        <div class="bl__nav-body">
          <nav class="bl__nav-rail">
            <For each={props.cats}>
              {(c) => (
                <button
                  class={`bl__nav-cat ${props.navCat() === c.id ? "is-active" : ""}`}
                  onMouseEnter={() => props.setNavCat(c.id)}
                  onFocus={() => props.setNavCat(c.id)}
                  onClick={() => props.setNavCat(c.id)}
                >
                  <span class="bl__nav-num">{c.num}</span>
                  <span class="bl__nav-ico">{c.ico}</span>
                  <span class="bl__nav-label">{c.label}</span>
                  <svg class="bl__nav-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 4l4 4-4 4"/>
                  </svg>
                </button>
              )}
            </For>
          </nav>

          <div class="bl__nav-pane-viewport">
            <div
              class="bl__nav-pane-track"
              style={{ transform: `translateY(-${props.cats.findIndex(c => c.id === props.navCat()) * 100}%)` }}
            >
              <For each={props.cats}>
                {(cat) => (
                  <div class="bl__nav-pane">
                    <div class="bl__nav-pane-head">
                      <span class="bl__nav-pane-num">{cat.num} ·</span>
                      <span class="bl__nav-pane-title">{cat.label}</span>
                    </div>
                    <ul class="bl__nav-items">
                      <For each={cat.items}>
                        {(it) => {
                          const isDisabled = () => it.disabled?.() ?? !it.action;
                          const labelText = () => typeof it.label === "function" ? it.label() : it.label;
                          return (
                            <li>
                              <button
                                class="bl__nav-item"
                                disabled={isDisabled()}
                                onClick={() => !isDisabled() && it.action?.()}
                              >
                                <span class="bl__nav-item-label">{labelText()}</span>
                                <Show when={it.kbd}>
                                  <span class="bl__nav-kbd">{it.kbd}</span>
                                </Show>
                              </button>
                            </li>
                          );
                        }}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="bl__nav-foot">
          <button class="bl__nav-exit" onClick={props.onExit}>
            <span class="bl__nav-exit-ico">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h5"/>
                <path d="M11 5l-3 3 3 3M8 8h6"/>
              </svg>
            </span>
            <span class="bl__nav-exit-text">
              <span class="bl__nav-exit-label">Exit to</span>
              <span class="bl__nav-exit-value">Dashboard</span>
            </span>
            <svg class="bl__nav-exit-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </button>
          <div class="bl__nav-meta">
            <span class="bl__nav-meta-key">Project</span>
            <span class="bl__nav-meta-val">{props.name()}</span>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default NavDrawer;
