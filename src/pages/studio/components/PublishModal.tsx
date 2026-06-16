import { type Component, type Accessor, createSignal, Show } from "solid-js";
import { apiFetch, publishProjectApi } from "~/lib/api";

const GENRES = [
  "Other", "Hip Hop", "R&B", "Pop", "Rock", "Electronic", "Jazz",
  "Classical", "Country", "Reggae", "Latin", "Metal", "Indie", "Lo-Fi",
  "Trap", "Drill", "House", "Techno", "Ambient", "Soul", "Funk",
] as const;

interface PublishModalProps {
  projectId: string;
  projectName: Accessor<string>;
  published: Accessor<boolean>;
  onClose: () => void;
  onPublished: (published: boolean) => void;
}

const PublishModal: Component<PublishModalProps> = (props) => {
  const [name, setName] = createSignal(props.projectName());
  const [genre, setGenre] = createSignal("Other");
  const [description, setDescription] = createSignal("");
  const [explicit, setExplicit] = createSignal(false);
  const [unlisted, setUnlisted] = createSignal(false);
  const [advOpen, setAdvOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [coverUrl, setCoverUrl] = createSignal<string | null>(null);

  let coverInput!: HTMLInputElement;

  const handleCoverClick = () => coverInput.click();

  const handleCoverChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const descLen = () => description().length;

  const handlePublish = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/projects/${props.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name(),
          genre: genre(),
          description: description() || undefined,
          explicit: explicit(),
          coverUrl: coverUrl() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      await publishProjectApi(props.projectId, true);
      props.onPublished(true);
      props.onClose();
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="bl__overlay" onClick={props.onClose}>
      <div class="bl__modal bl__modal--publish" onClick={(e) => e.stopPropagation()}>
        <button class="bl__modal-close" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <h2 class="bl__pub-title">{name() || "Untitled"}</h2>

        <div class="bl__pub-body">
          <div class="bl__pub-cover" onClick={handleCoverClick}>
            <input
              ref={coverInput!}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
            />
            <Show when={coverUrl()} fallback={
              <svg viewBox="0 0 48 48" fill="currentColor" opacity="0.4">
                <path d="M38 6v28a6 6 0 1 1-4-5.66V12L18 15v23a6 6 0 1 1-4-5.66V10l24-4z" />
              </svg>
            }>
              <img src={coverUrl()!} alt="Cover" />
            </Show>
          </div>

          <div class="bl__pub-fields">
            <label class="bl__pub-label">Project name</label>
            <input
              class="bl__pub-input"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              maxLength={100}
            />

            <label class="bl__pub-label">Genre</label>
            <div class="bl__pub-select-wrap">
              <select class="bl__pub-select" value={genre()} onChange={(e) => setGenre(e.currentTarget.value)}>
                {GENRES.map((g) => <option value={g}>{g}</option>)}
              </select>
              <svg class="bl__pub-select-arrow" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4" /></svg>
            </div>
            <span class="bl__pub-hint">Choose the right genre to find your target audience.</span>

            <div class="bl__pub-label-row">
              <label class="bl__pub-label">Description</label>
              <span class="bl__pub-counter">{descLen()}/250</span>
            </div>
            <div class="bl__pub-textarea-wrap">
              <textarea
                class="bl__pub-textarea"
                placeholder={'eg: "Added my #voice! Looking for a #guitarist now!"'}
                value={description()}
                onInput={(e) => {
                  if (e.currentTarget.value.length <= 250) setDescription(e.currentTarget.value);
                }}
                maxLength={250}
                rows={3}
              />
            </div>
          </div>
        </div>

        <button class="bl__pub-adv-toggle" onClick={() => setAdvOpen(!advOpen())}>
          Advanced Settings
          <svg class={`bl__pub-adv-chevron${advOpen() ? " bl__pub-adv-chevron--open" : ""}`} viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        <Show when={advOpen()}>
          <div class="bl__pub-adv">
            <div class="bl__pub-adv-row">
              <div>
                <span class="bl__pub-adv-name">Explicit Content</span>
                <span class="bl__pub-adv-desc">This will mark your track as explicit content.</span>
              </div>
              <button class={`bl__pub-toggle${explicit() ? " bl__pub-toggle--on" : ""}`} onClick={() => setExplicit(!explicit())}>
                <span class="bl__pub-toggle-dot" />
              </button>
            </div>
            <div class="bl__pub-adv-row">
              <div>
                <span class="bl__pub-adv-name">Unlisted</span>
                <span class="bl__pub-adv-desc">An unlisted track will be public but won't appear in public feeds.</span>
              </div>
              <button class={`bl__pub-toggle${unlisted() ? " bl__pub-toggle--on" : ""}`} onClick={() => setUnlisted(!unlisted())}>
                <span class="bl__pub-toggle-dot" />
              </button>
            </div>
          </div>
        </Show>

        <Show when={err()}>
          <p class="bl__pub-err">{err()}</p>
        </Show>

        <div class="bl__pub-actions">
          <button class="bl__pub-btn bl__pub-btn--cancel" onClick={props.onClose}>Cancel</button>
          <button class="bl__pub-btn bl__pub-btn--publish" disabled={busy()} onClick={handlePublish}>
            {busy() ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishModal;
