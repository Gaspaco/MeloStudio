import { type Component, createSignal, Show, For } from "solid-js";
import type { Accessor, Setter } from "solid-js";

interface LrcResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

type Props = {
  text: Accessor<string>;
  onSetText: Setter<string>;
  onClose: () => void;
  projectName?: Accessor<string>;
  projectId?: string;
};

const LyricsPanel: Component<Props> = (props) => {
  const [searchTitle, setSearchTitle] = createSignal(props.projectName?.() ?? "");
  const [searchArtist, setSearchArtist] = createSignal("");
  const [results, setResults] = createSignal<LrcResult[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchErr, setSearchErr] = createSignal("");
  const [transcribing, setTranscribing] = createSignal(false);
  const [transcribeErr, setTranscribeErr] = createSignal("");

  const doSearch = async () => {
    const title = searchTitle().trim();
    if (!title) return;
    setSearching(true);
    setSearchErr("");
    setResults([]);
    try {
      const params = new URLSearchParams({ q: title });
      if (searchArtist().trim()) params.set("artist_name", searchArtist().trim());
      const res = await fetch(`https://lrclib.net/api/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as LrcResult[];
      const filtered = data.filter((r) => r.syncedLyrics || r.plainLyrics);
      setResults(filtered);
      if (filtered.length === 0) setSearchErr("No results found.");
    } catch {
      setSearchErr("Search failed. Check your connection.");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: LrcResult) => {
    props.onSetText(r.syncedLyrics ?? r.plainLyrics ?? "");
    setResults([]);
  };

  const doTranscribe = async () => {
    if (!props.projectId) return;
    setTranscribing(true);
    setTranscribeErr("");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: props.projectId }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setTranscribeErr(msg || "Transcription failed.");
        return;
      }
      const { lrc } = (await res.json()) as { lrc: string };
      props.onSetText(lrc);
    } catch {
      setTranscribeErr("Transcription failed. Check your connection.");
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <>
      <div class="bl__lyrics-overlay" onClick={props.onClose} />
      <aside class="bl__lyrics-panel">
        <div class="bl__lyrics-header">
          <div class="bl__lyrics-header-l">
            <span class="bl__lyrics-eyebrow">— Lyrics / Notes</span>
            <span class="bl__lyrics-hint">{props.text().length} chars</span>
          </div>
          <div class="bl__lyrics-header-r">
            <Show when={props.projectId}>
              <button
                class={`bl__lyrics-find-btn${transcribing() ? " bl__lyrics-find-btn--busy" : ""}`}
                onClick={() => void doTranscribe()}
                disabled={transcribing()}
                title="Transcribe vocals from your mix using Groq Whisper AI"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1v7M5 4l3-3 3 3M3 10a5 5 0 0010 0"/></svg>
                {transcribing() ? "Transcribing…" : "Transcribe"}
              </button>
            </Show>
            <button class="bl__lyrics-x" onClick={props.onClose} aria-label="Close">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>
          </div>
        </div>

        {/* ── LRCLIB search ── */}
        <div class="bl__lyrics-search">
          <div class="bl__lyrics-search-row">
            <input
              class="bl__lyrics-search-input"
              placeholder="Song title"
              value={searchTitle()}
              onInput={(e) => setSearchTitle(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && void doSearch()}
            />
            <input
              class="bl__lyrics-search-input"
              placeholder="Artist"
              value={searchArtist()}
              onInput={(e) => setSearchArtist(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && void doSearch()}
            />
            <button
              class="bl__lyrics-search-btn"
              onClick={() => void doSearch()}
              disabled={searching()}
            >
              {searching() ? "…" : "Search"}
            </button>
          </div>
          <Show when={searchErr()}>
            <p class="bl__lyrics-search-err">{searchErr()}</p>
          </Show>
          <Show when={transcribeErr()}>
            <p class="bl__lyrics-search-err">{transcribeErr()}</p>
          </Show>
          <Show when={results().length > 0}>
            <div class="bl__lyrics-results">
              <For each={results()}>
                {(r) => (
                  <button class="bl__lyrics-result" onClick={() => pickResult(r)}>
                    <span class="bl__lyrics-result-name">
                      {r.trackName}
                      <Show when={r.syncedLyrics}>
                        <span class="bl__lyrics-result-badge">Synced</span>
                      </Show>
                    </span>
                    <span class="bl__lyrics-result-meta">{r.artistName} — {r.albumName}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="bl__lyrics-body">
          <textarea
            class="bl__lyrics-textarea"
            placeholder="Write or paste lyrics here… LRC [MM:SS.xx] format supported for sync"
            value={props.text()}
            onInput={(e) => props.onSetText(e.currentTarget.value)}
          />
        </div>
      </aside>
    </>
  );
};

export default LyricsPanel;
