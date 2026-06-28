// Authorship: Malikhai built this piano-roll editor and its note editing tools.
//
// The important rule here is simple: X is time in clip-relative bars, Y is the
// MIDI pitch, and velocity controls how hard the note plays. Keeping notes
// clip-relative means moving the region does not move every note by hand.
import { type Component, createSignal, createMemo, createEffect, For, Show, onMount, onCleanup, on } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { UITrack, MediaClip, MidiNoteEvent } from "../types";
import { STUDIO_BAR_PX } from "../lib/regionMath";

export interface PianoRollProps {
  tracks: Accessor<UITrack[]>;
  clip: Accessor<MediaClip | null>;
  trackId: Accessor<string | null>;
  trackColor: Accessor<string>;
  bpm: Accessor<number>;
  timeSignature: Accessor<[number, number]>;
  playheadPx: Accessor<number>;
  onUpdateNotes: (trackId: string, clipId: string, notes: MidiNoteEvent[]) => void;
  onNoteOn?: (midi: number) => void;
  onNoteOff?: (midi: number) => void;
  onClose: () => void;
}

const MIN_DUR = 1 / 32;

const SCALES: Record<string, number[]> = {
  "None": [],
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Natural Minor": [0, 2, 3, 5, 7, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
  "Blues": [0, 3, 4, 5, 7, 10],
  "Dorian": [0, 2, 3, 5, 7, 9, 10],
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PianoRoll: Component<PianoRollProps> = (props) => {
  let gridScrollEl: HTMLDivElement | undefined;
  let sidebarScrollEl: HTMLDivElement | undefined;
  let rulerScrollEl: HTMLDivElement | undefined;
  let velScrollEl: HTMLDivElement | undefined;

  const [snap, setSnap] = createSignal<number>(0.25); // 1/4 bar by default
  const [rootNote, setRootNote] = createSignal<number>(0); // 0 = C
  const [scaleType, setScaleType] = createSignal<string>("None");
  const [ghostOn, setGhostOn] = createSignal<boolean>(false);
  
  const [zoomX, setZoomX] = createSignal<number>(1);
  const [zoomY, setZoomY] = createSignal<number>(1);
  
  const barPx = () => STUDIO_BAR_PX * zoomX();
  const rowH = () => 14 * zoomY();

  // Derived state
  const clip = () => props.clip();
  const bars = createMemo(() => Math.max(1, clip()?.bars ?? 4));
  const notes = createMemo(() => clip()?.midiNotes ?? []);

  // UI state for scrolling sync
  const onScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    if (sidebarScrollEl && target === gridScrollEl) {
      sidebarScrollEl.scrollTop = target.scrollTop;
    }
    if (rulerScrollEl && target === gridScrollEl) {
      rulerScrollEl.scrollLeft = target.scrollLeft;
    }
    if (velScrollEl && target === gridScrollEl) {
      velScrollEl.scrollLeft = target.scrollLeft;
    }
  };

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        setZoomY(z => Math.max(0.5, Math.min(3, z - e.deltaY * 0.01)));
      } else {
        setZoomX(z => Math.max(0.2, Math.min(5, z - e.deltaY * 0.01)));
      }
    }
  };

  // Scale highlighting logic
  const scaleNotes = createMemo(() => {
    const type = scaleType();
    if (type === "None") return new Set<number>();
    const pattern = SCALES[type] ?? [];
    const root = rootNote();
    const set = new Set<number>();
    for (let oct = 0; oct < 11; oct++) {
      for (const interval of pattern) {
        const midi = oct * 12 + ((root + interval) % 12);
        if (midi <= 127) set.add(midi);
      }
    }
    return set;
  });

  const isBlackKey = (midi: number) => {
    const note = midi % 12;
    return [1, 3, 6, 8, 10].includes(note);
  };

  const isC = (midi: number) => midi % 12 === 0;

  const noteClass = (midi: number) => {
    const black = isBlackKey(midi);
    const cKey = isC(midi);
    const inScale = scaleNotes().has(midi);
    const hasScale = scaleType() !== "None";

    let cls = "bl__pr-row";
    if (black) cls += " is-black";
    if (cKey) cls += " is-c";

    if (hasScale) {
      if (inScale) cls += " is-in-key";
      else cls += " is-out-of-key";
    }
    return cls;
  };

  // Ghost channels
  const ghostNotes = createMemo(() => {
    if (!ghostOn()) return [];
    const currentClip = clip();
    const currentTrackId = props.trackId();
    if (!currentClip || !currentTrackId) return [];

    const startBars = currentClip.barStart;
    const endBars = currentClip.barStart + currentClip.bars;
    const ghosts: { midi: number; startBars: number; durationBars: number; color: string }[] = [];

    for (const track of props.tracks()) {
      if (track.id === currentTrackId) continue; // Skip current track
      if (track.type !== "instrument" && track.type !== "drum" && track.type !== "bass" && track.type !== "guitar") continue;
      
      for (const tClip of track.clips ?? []) {
        if (tClip.kind !== "midi" || !tClip.midiNotes) continue;
        
        // Check overlap
        const tStart = tClip.barStart;
        const tEnd = tClip.barStart + tClip.bars;
        if (tStart < endBars && tEnd > startBars) {
          // Add notes that overlap the current clip
          for (const note of tClip.midiNotes) {
            const noteAbsoluteStart = tClip.barStart + note.startBars;
            const noteAbsoluteEnd = noteAbsoluteStart + note.durationBars;
            
            if (noteAbsoluteStart < endBars && noteAbsoluteEnd > startBars) {
              // Convert to local time of the current clip
              ghosts.push({
                midi: note.midi,
                startBars: noteAbsoluteStart - currentClip.barStart,
                durationBars: note.durationBars,
                color: track.color
              });
            }
          }
        }
      }
    }
    return ghosts;
  });

  // Editor Interaction State
  type DragState = 
    | { mode: "draw"; startX: number; startBars: number; midi: number; durationBars: number; velocity: number }
    | { mode: "move"; noteIndex: number; startX: number; startY: number; origStartBars: number; origMidi: number; newStartBars: number; newMidi: number }
    | { mode: "trim"; noteIndex: number; startX: number; origDurationBars: number; newDurationBars: number; origMidi: number }
    | { mode: "velocity"; noteIndex: number; startY: number; origVelocity: number; newVelocity: number; origMidi: number }
    | null;

  const [dragState, setDragState] = createSignal<DragState>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = createSignal<number | null>(null);
  const [playingKeys, setPlayingKeys] = createSignal<Set<number>>(new Set());

  const noteVisual = (note: MidiNoteEvent, noteIndex: number) => {
    let startBars = note.startBars;
    let midi = note.midi;
    let durationBars = note.durationBars;
    let velocity = note.velocity;
    let isDragging = false;
    let isVelocityDragging = false;
    const state = dragState();

    if (state && state.mode !== "draw" && state.noteIndex === noteIndex) {
      isDragging = true;
      if (state.mode === "move") {
        startBars = state.newStartBars;
        midi = state.newMidi;
      } else if (state.mode === "trim") {
        durationBars = state.newDurationBars;
      } else {
        velocity = state.newVelocity;
        isVelocityDragging = true;
      }
    }

    return { startBars, midi, durationBars, velocity, isDragging, isVelocityDragging };
  };

  const drawnNote = () => {
    const state = dragState();
    return state?.mode === "draw" ? state : null;
  };

  const noteOn = (midi: number) => {
    setPlayingKeys(s => { const ns = new Set(s); ns.add(midi); return ns; });
    props.onNoteOn?.(midi);
  };
  
  const noteOff = (midi: number) => {
    setPlayingKeys(s => { const ns = new Set(s); ns.delete(midi); return ns; });
    props.onNoteOff?.(midi);
  };

  const commitNotes = (newNotes: MidiNoteEvent[]): boolean => {
    const trackId = props.trackId();
    const currentClip = clip();
    if (!trackId || !currentClip) return false;
    props.onUpdateNotes(trackId, currentClip.id, newNotes);
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      const idx = selectedNoteIndex();
      if (idx === null) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const newNotes = [...notes()];
      newNotes.splice(idx, 1);
      if (!commitNotes(newNotes)) return;
      setSelectedNoteIndex(null);
    }
  };

  const getSnappedBars = (bars: number) => {
    const s = snap();
    if (s <= 0) return bars;
    return Math.round(bars / s) * s;
  };

  const handleGridMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const grid = gridScrollEl;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left + grid.scrollLeft;
    const y = e.clientY - rect.top + grid.scrollTop;

    const barClick = Math.max(0, x / barPx());
    const snappedStart = getSnappedBars(barClick);
    const midi = 127 - Math.floor(y / rowH());

    // If clicking on an existing note, don't draw
    if ((e.target as HTMLElement).closest('.bl__pr-note')) return;

    setSelectedNoteIndex(null);
    noteOn(midi);

    setDragState({
      mode: "draw",
      startX: e.clientX,
      startBars: snappedStart,
      midi,
      durationBars: snap() || 0.25,
      velocity: 0.8
    });
  };

  const handleNoteMouseDown = (e: MouseEvent, index: number, isRightEdge: boolean) => {
    if (e.button === 2) {
      const newNotes = [...notes()];
      newNotes.splice(index, 1);
      if (!commitNotes(newNotes)) return;
      if (selectedNoteIndex() === index) setSelectedNoteIndex(null);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedNoteIndex(index);
    const note = notes()[index];
    if (!note) return;
    noteOn(note.midi);

    if (isRightEdge) {
      setDragState({
        mode: "trim",
        noteIndex: index,
        startX: e.clientX,
        origDurationBars: note.durationBars,
        newDurationBars: note.durationBars,
        origMidi: note.midi
      });
    } else {
      setDragState({
        mode: "move",
        noteIndex: index,
        startX: e.clientX,
        startY: e.clientY,
        origStartBars: note.startBars,
        origMidi: note.midi,
        newStartBars: note.startBars,
        newMidi: note.midi
      });
    }
  };

  const handleNoteDoubleClick = (e: MouseEvent, index: number) => {
    e.stopPropagation();
    const newNotes = [...notes()];
    newNotes.splice(index, 1);
    if (!commitNotes(newNotes)) return;
    if (selectedNoteIndex() === index) setSelectedNoteIndex(null);
  };

  const handleVelocityMouseDown = (e: MouseEvent, index: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const note = notes()[index];
    if (!note) return;
    setDragState({
      mode: "velocity",
      noteIndex: index,
      startY: e.clientY,
      origVelocity: note.velocity,
      newVelocity: note.velocity,
      origMidi: note.midi
    });
  };

  const handleWinMouseMove = (e: MouseEvent) => {
    const ds = dragState();
    if (!ds) return;

    if (ds.mode === "draw") {
      const deltaX = e.clientX - ds.startX;
      const deltaBars = deltaX / barPx();
      let newDuration = Math.max(MIN_DUR, getSnappedBars((snap() || 0.25) + deltaBars));
      setDragState({ ...ds, durationBars: newDuration });
    } else if (ds.mode === "move") {
      const deltaX = e.clientX - ds.startX;
      const deltaY = e.clientY - ds.startY;
      const deltaBars = deltaX / barPx();
      const deltaMidi = Math.round(-deltaY / rowH());

      setDragState({ 
        ...ds, 
        newStartBars: Math.max(0, getSnappedBars(ds.origStartBars + deltaBars)),
        newMidi: Math.max(0, Math.min(127, ds.origMidi + deltaMidi))
      });
    } else if (ds.mode === "trim") {
      const deltaX = e.clientX - ds.startX;
      const deltaBars = deltaX / barPx();
      setDragState({
        ...ds,
        newDurationBars: Math.max(MIN_DUR, getSnappedBars(ds.origDurationBars + deltaBars))
      });
    } else if (ds.mode === "velocity") {
      const deltaY = ds.startY - e.clientY;
      const deltaVel = deltaY / 60;
      setDragState({
        ...ds,
        newVelocity: Math.max(0, Math.min(1, ds.origVelocity + deltaVel))
      });
    }
  };

  const handleWinMouseUp = () => {
    const ds = dragState();
    
    if (ds) {
      if (ds.mode === "draw") noteOff(ds.midi);
      else if (ds.mode === "move") { noteOff(ds.origMidi); noteOff(ds.newMidi); }
      else if (ds.mode === "trim") noteOff(ds.origMidi);
      else if (ds.mode === "velocity") noteOff(ds.origMidi);
    }

    if (!ds) {
      setDragState(null);
      return;
    }

    if (ds.mode === "draw") {
      const newNotes = [...notes(), {
        midi: ds.midi,
        startBars: ds.startBars,
        durationBars: ds.durationBars,
        velocity: ds.velocity
      }];
      commitNotes(newNotes);
    } else if (ds.mode === "move") {
      const newNotes = [...notes()];
      const note = newNotes[ds.noteIndex];
      if (note) {
        newNotes[ds.noteIndex] = { ...note, startBars: ds.newStartBars, midi: ds.newMidi };
        commitNotes(newNotes);
      }
    } else if (ds.mode === "trim") {
      const newNotes = [...notes()];
      const note = newNotes[ds.noteIndex];
      if (note) {
        newNotes[ds.noteIndex] = { ...note, durationBars: ds.newDurationBars };
        commitNotes(newNotes);
      }
    } else if (ds.mode === "velocity") {
      const newNotes = [...notes()];
      const note = newNotes[ds.noteIndex];
      if (note) {
        newNotes[ds.noteIndex] = { ...note, velocity: ds.newVelocity };
        commitNotes(newNotes);
      }
    }
    setDragState(null);
  };

  onMount(() => {
    window.addEventListener("mousemove", handleWinMouseMove);
    window.addEventListener("mouseup", handleWinMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    // Initial scroll position around C4 (MIDI 60)
    if (gridScrollEl) {
      gridScrollEl.scrollTop = (127 - 72) * rowH();
    }
  });

  onCleanup(() => {
    window.removeEventListener("mousemove", handleWinMouseMove);
    window.removeEventListener("mouseup", handleWinMouseUp);
    window.removeEventListener("keydown", handleKeyDown);
  });

  // Generate grid rows (0 to 127, rendered top-to-bottom so 127 is first)
  const midiRows = Array.from({ length: 128 }, (_, i) => 127 - i);

  return (
    <div class="bl__pr" onContextMenu={(e) => e.preventDefault()}>
      {/* TOOLBAR */}
      <div class="bl__pr-toolbar">
        <button class="bl__pr-close" onClick={props.onClose} title="Close Editor">×</button>
        <span class="bl__pr-clip-name">{clip()?.name ?? "Piano Roll"}</span>
        <div class="bl__pr-divider" />
        
        <span class="bl__pr-label">Snap</span>
        <select class="bl__pr-select" value={snap()} onChange={(e) => setSnap(parseFloat(e.currentTarget.value))}>
          <option value={1}>1 Bar</option>
          <option value={0.5}>1/2</option>
          <option value={0.25}>1/4</option>
          <option value={0.125}>1/8</option>
          <option value={0.0625}>1/16</option>
          <option value={0}>None</option>
        </select>

        <div class="bl__pr-divider" />
        <span class="bl__pr-label">Scale</span>
        <select class="bl__pr-select" value={rootNote()} onChange={(e) => setRootNote(parseInt(e.currentTarget.value))}>
          {NOTE_NAMES.map((name, i) => <option value={i}>{name}</option>)}
        </select>
        <select class="bl__pr-select" value={scaleType()} onChange={(e) => setScaleType(e.currentTarget.value)}>
          {Object.keys(SCALES).map(scale => <option value={scale}>{scale}</option>)}
        </select>

        <div class="bl__pr-divider" />
        <button 
          class={`bl__pr-ghost-btn ${ghostOn() ? "is-on" : ""}`}
          onClick={() => setGhostOn(!ghostOn())}
          title="Toggle Ghost Channels (notes from other tracks)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>
          Ghost
        </button>

        <div class="bl__pr-divider" />
        <div class="bl__pr-zoom-ctrls" style={{ display: "flex", gap: "2px" }}>
          <button class="bl__pr-ghost-btn" onClick={() => setZoomX(z => Math.max(0.2, z - 0.2))} title="Zoom Out (Time)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button class="bl__pr-ghost-btn" onClick={() => setZoomX(z => Math.min(5, z + 0.2))} title="Zoom In (Time)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
        </div>
      </div>

      <div class="bl__pr-body">
        {/* SIDEBAR (Piano Keys) */}
        <div class="bl__pr-sidebar">
          <div class="bl__pr-sidebar-ruler" />
          <div class="bl__pr-sidebar-keys" ref={sidebarScrollEl}>
            <div class="bl__pr-keys-inner" style={{ height: `${128 * rowH()}px` }}>
              <For each={midiRows}>
                {(midi) => (
                  <div 
                    class={`bl__pr-key ${isBlackKey(midi) ? "is-black" : ""} ${isC(midi) ? "is-c" : ""} ${playingKeys().has(midi) ? "is-playing" : ""}`} 
                    style={{ top: `${(127 - midi) * rowH()}px`, position: "absolute" }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      noteOn(midi);
                      const stop = () => { noteOff(midi); window.removeEventListener("mouseup", stop); };
                      window.addEventListener("mouseup", stop);
                    }}
                  >
                    {isC(midi) ? `C${Math.floor(midi / 12) - 1}` : ""}
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div class="bl__pr-grid-wrap">
          {/* Ruler */}
          <div class="bl__pr-ruler" ref={rulerScrollEl}>
            <div class="bl__pr-ruler-inner" style={{ width: `${bars() * barPx()}px` }}>
              <For each={Array.from({ length: bars() }, (_, i) => i)}>
                {(bar) => (
                  <div class="bl__pr-ruler-bar">{bar + 1}</div>
                )}
              </For>
            </div>
          </div>

          {/* Scrolling Grid */}
          <div class="bl__pr-scroll" ref={gridScrollEl} onScroll={onScroll} onWheel={handleWheel} onMouseDown={handleGridMouseDown}>
            <div class="bl__pr-grid" style={{ width: `${bars() * barPx()}px`, height: `${128 * rowH()}px` }}>
              
              {/* Background Rows */}
              <div class="bl__pr-gridlines">
                <For each={midiRows}>
                  {(midi) => (
                    <div class={noteClass(midi)} style={{ top: `${(127 - midi) * rowH()}px`, position: "absolute", width: "100%" }} />
                  )}
                </For>
              </div>

              {/* Vertical Beat Lines */}
              <div class="bl__pr-gridlines">
                <For each={Array.from({ length: bars() * 4 }, (_, i) => i)}>
                  {(beat) => (
                    <div class={`bl__pr-gridline ${beat % 4 === 0 ? "is-bar" : "is-beat"}`} style={{ left: `${beat * (barPx() / 4)}px` }} />
                  )}
                </For>
              </div>

              {/* Ghost Notes */}
              <For each={ghostNotes()}>
                {(ghost) => (
                  <div 
                    class="bl__pr-ghost-note"
                    style={{
                      left: `${ghost.startBars * barPx()}px`,
                      top: `${(127 - ghost.midi) * rowH() + 1}px`,
                      width: `${ghost.durationBars * barPx()}px`,
                      "background-color": ghost.color,
                    }}
                  />
                )}
              </For>

              {/* Actual Notes */}
              <For each={notes()}>
                {(note, index) => {
                  const visual = createMemo(() => noteVisual(note, index()));
                  return (
                    <div
                      class={`bl__pr-note ${visual().isDragging ? "is-dragging" : ""} ${selectedNoteIndex() === index() ? "is-selected" : ""}`}
                      style={{
                        left: `${visual().startBars * barPx()}px`,
                        top: `${(127 - visual().midi) * rowH() + 1}px`,
                        width: `${visual().durationBars * barPx()}px`,
                        background: props.trackColor(),
                        opacity: 0.4 + (visual().velocity * 0.6)
                      }}
                      onMouseDown={(e) => handleNoteMouseDown(e, index(), false)}
                      onDblClick={(e) => handleNoteDoubleClick(e, index())}
                    >
                      <div class="bl__pr-note-resize" onMouseDown={(e) => handleNoteMouseDown(e, index(), true)} />
                    </div>
                  );
                }}
              </For>

              {/* Currently Drawn Note */}
              <Show when={drawnNote()}>
                {(state) => (
                  <div
                    class="bl__pr-note is-dragging"
                    style={{
                      left: `${state().startBars * barPx()}px`,
                      top: `${(127 - state().midi) * rowH() + 1}px`,
                      width: `${state().durationBars * barPx()}px`,
                      background: props.trackColor()
                    }}
                  />
                )}
              </Show>

              {/* Playhead */}
              <Show when={props.playheadPx() >= (clip()?.barStart ?? 0) * barPx() && props.playheadPx() <= ((clip()?.barStart ?? 0) + bars()) * barPx()}>
                <div class="bl__pr-playhead" style={{ left: `${props.playheadPx() - (clip()?.barStart ?? 0) * barPx()}px` }} />
              </Show>
            </div>
          </div>
        </div>
      </div>

      {/* Velocity Lane */}
      <div class="bl__pr-velocity">
        <div class="bl__pr-vel-sidebar">Velocity</div>
        <div class="bl__pr-vel-area" ref={velScrollEl}>
          <div class="bl__pr-vel-inner" style={{ width: `${bars() * barPx()}px` }}>
            {/* Ghost Velocities */}
            <For each={ghostNotes()}>
              {(ghost) => (
                <div class="bl__pr-vel-bar" style={{ left: `${ghost.startBars * barPx() + 2}px`, height: `40px`, background: ghost.color, opacity: 0.1, "pointer-events": "none" }} />
              )}
            </For>
            
            {/* Velocity Actual */}
            <For each={notes()}>
              {(note, index) => {
                const visual = createMemo(() => noteVisual(note, index()));
                return (
                  <div
                    class={`bl__pr-vel-bar ${visual().isVelocityDragging ? "is-dragging" : ""} ${selectedNoteIndex() === index() ? "is-selected" : ""}`}
                    style={{
                      left: `${visual().startBars * barPx()}px`,
                      height: `${visual().velocity * 60}px`,
                      background: props.trackColor(),
                      opacity: visual().isVelocityDragging ? 0.9 : 0.6
                    }}
                    onMouseDown={(e) => handleVelocityMouseDown(e, index())}
                  >
                    <div class="bl__pr-vel-cap" />
                  </div>
                );
              }}
            </For>

            {/* Drawn Velocity */}
            <Show when={drawnNote()}>
              {(state) => (
                <div
                  class="bl__pr-vel-bar"
                  style={{
                    left: `${state().startBars * barPx() + 2}px`,
                    height: `${Math.max(3, state().velocity * 60)}px`,
                    background: props.trackColor(),
                    opacity: 0.8
                  }}
                />
              )}
            </Show>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PianoRoll;
