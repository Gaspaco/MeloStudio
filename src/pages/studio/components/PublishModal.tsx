import { type Component, createSignal, Show } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { publishProjectApi } from "~/lib/api";

const PublishModal: Component<{
  projectId: string;
  published: Accessor<boolean>;
  setPublished: Setter<boolean>;
  onClose: () => void;
}> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [err, setErr] = createSignal("");

  const shareUrl = () => `${window.location.origin}/share/${props.projectId}`;

  const toggle = async () => {
    setBusy(true);
    setErr("");
    try {
      const next = !props.published();
      await publishProjectApi(props.projectId, next);
      props.setPublished(next);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      class="bl__overlay"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="bl__modal bl__publish-modal">
        <button class="bl__pm-close" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 3l10 10M13 3L3 13"/>
          </svg>
        </button>

        <div class="bl__pm-header">
          <svg class="bl__pm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17V3M7 8l5-5 5 5M3 20h18"/>
          </svg>
          <div>
            <h2>Share your project</h2>
            <p>Anyone with the link can listen — no login required.</p>
          </div>
        </div>

        <Show when={props.published()}>
          <div class="bl__pm-url-row">
            <span class="bl__pm-url">{shareUrl()}</span>
            <button class="bl__pm-copy" onClick={copyLink}>
              {copied() ? "Copied!" : "Copy link"}
            </button>
          </div>
        </Show>

        <Show when={err()}>
          <p class="bl__pm-err">{err()}</p>
        </Show>

        <div class="bl__pm-actions">
          <Show
            when={props.published()}
            fallback={
              <button class="bl__btn-accent" onClick={toggle} disabled={busy()}>
                {busy() ? "Publishing…" : "Publish project"}
              </button>
            }
          >
            <button class="bl__btn-ghost bl__btn-ghost--danger" onClick={toggle} disabled={busy()}>
              {busy() ? "Unpublishing…" : "Unpublish"}
            </button>
            <a class="bl__btn-accent" href={shareUrl()} target="_blank" rel="noopener noreferrer">
              Open share page ↗
            </a>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default PublishModal;
