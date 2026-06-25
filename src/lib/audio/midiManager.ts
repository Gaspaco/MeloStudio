import { getAudioContext, unlockAudioContext } from "./context";
import { setConnectedMidiDevices, type SimpleMidiDevice } from "../state/transportStore";
import type { PolySynth } from "./synth";

class MidiHardwareManager {
  private midiAccess: MIDIAccess | null = null;
  private activeSynth: PolySynth | null = null;
  private enabled = true;
  private noteListener: ((event: { type: "on" | "off"; midi: number; velocity: number; receivedAt: number }) => void) | null = null;
  /** Notes that were pressed but whose noteOff arrived while the synth was unbound. Flushed on rebind. */
  private pendingNoteOffs = new Set<number>();
  /** Notes currently held (noteOn received, noteOff not yet sent to synth). */
  private heldNotes = new Set<number>();

  /**
   * Initializes the browser Web MIDI API subsystem and subscribes to hardware inputs.
   */
  async initialize(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn("This browser does not support the Web MIDI API.");
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      
      // Handle physical MIDI cables plugging/unplugging in real-time
      this.midiAccess.onstatechange = () => {
        this.scanDevices();
      };

      this.scanDevices();
      return true;
    } catch (error) {
      console.error("Failed to acquire MIDI access authorization:", error);
      return false;
    }
  }

  /**
   * Binds the incoming hardware inputs to trigger a specific PolySynth instance.
   * Call this whenever the user switches active tracks in the DAW timeline.
   * Flushes any pending note-offs that arrived while the synth was unbound.
   */
  bindTargetSynth(synth: PolySynth | null): void {
    if (this.activeSynth && this.activeSynth !== synth) this.activeSynth.allNotesOff();
    this.activeSynth = synth;
    // Flush note-offs that were received while no synth was bound
    if (synth && this.pendingNoteOffs.size > 0) {
      for (const midi of this.pendingNoteOffs) {
        synth.noteOff(midi);
      }
      this.pendingNoteOffs.clear();
    }
    // If we're binding a fresh synth, clear the held-notes tracking too since
    // we just called allNotesOff on the old synth.
    if (!synth) this.heldNotes.clear();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.activeSynth?.allNotesOff();
  }

  bindNoteListener(listener: ((event: { type: "on" | "off"; midi: number; velocity: number; receivedAt: number }) => void) | null): void {
    this.noteListener = listener;
  }

  /**
   * Scans attached physical equipment and keeps the SolidJS state store synchronized.
   * Re-binds message handlers on every scan so reconnected devices are always live.
   */
  private scanDevices(): void {
    if (!this.midiAccess) return;

    const devices: SimpleMidiDevice[] = [];
    const inputs = this.midiAccess.inputs.values();

    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
      const dev = input.value;
      devices.push({
        id: dev.id || "",
        name: dev.name || "Unknown Controller",
        manufacturer: dev.manufacturer || "Generic",
      });

      // Always re-bind so a unplugged/replugged device is immediately live again
      dev.onmidimessage = (event: MIDIMessageEvent) => this.handleMidiMessage(event);
    }

    // Kill any stuck notes when device list changes (e.g. keyboard unplugged mid-note)
    this.activeSynth?.allNotesOff();

    setConnectedMidiDevices(devices);
  }

  /** Last channel-voice status byte, for decoding running-status messages. */
  private lastStatus = 0;

  /**
   * Parses hardware MIDI message packets. Handles running status (keyboards omit
   * the status byte on consecutive same-command messages during fast playing,
   * sending 2-byte packets) so those notes aren't dropped, and ignores system
   * real-time bytes (clock/active-sensing) without clobbering running status.
   */
  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!this.enabled || !event.data || event.data.length === 0) return;

    // If no synth is bound, still track note-offs for currently-held notes so we
    // can flush them when the synth is rebound — preventing stuck notes on track switch.
    if (!this.activeSynth) {
      const first = event.data[0]!;
      if (first >= 0xf8) return;
      const command = first >= 0x80 ? (first & 0xf0) : (this.lastStatus & 0xf0);
      const data1 = first >= 0x80 ? (event.data[1] ?? 0) : first;
      const data2 = first >= 0x80 ? (event.data[2] ?? 0) : (event.data[1] ?? 0);
      if (command === 0x80 || (command === 0x90 && data2 === 0)) {
        if (this.heldNotes.has(data1)) {
          this.heldNotes.delete(data1);
          this.pendingNoteOffs.add(data1);
        }
      }
      return;
    }

    const bytes = event.data;
    const first = bytes[0]!;

    // System real-time (0xF8–0xFF: clock, active sensing, etc.) — ignore.
    if (first >= 0xf8) return;

    let status: number;
    let data1: number;
    let data2: number;
    if (first >= 0x80) {
      // Explicit status byte present.
      status = first;
      if (status < 0xf0) this.lastStatus = status; // only channel messages set running status
      data1 = bytes[1] ?? 0;
      data2 = bytes[2] ?? 0;
    } else {
      // Running status: status omitted, reuse the previous channel-voice status.
      if (this.lastStatus === 0) return;
      status = this.lastStatus;
      data1 = first;
      data2 = bytes[1] ?? 0;
    }

    const command = status & 0xf0; // Extract command byte type
    const receivedAt = event.timeStamp || performance.now();
    // const channel = status & 0x0f; // Extract MIDI channel (0-15) if needed later

    // Ensure the browser AudioContext has been physically unlocked by a gesture
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void unlockAudioContext();
    }

    switch (command) {
      case 0x90: { // Note On
        const velocity = data2 / 127;
        if (velocity > 0) {
          this.activeSynth.noteOn(data1, velocity);
          this.heldNotes.add(data1);
          this.pendingNoteOffs.delete(data1);
          this.noteListener?.({ type: "on", midi: data1, velocity, receivedAt });
        } else {
          // Note On with velocity 0 is the MIDI spec's way of sending Note Off
          this.activeSynth.noteOff(data1);
          this.heldNotes.delete(data1);
          this.pendingNoteOffs.delete(data1);
          this.noteListener?.({ type: "off", midi: data1, velocity: 0, receivedAt });
        }
        break;
      }
      case 0x80: { // Note Off
        this.activeSynth.noteOff(data1);
        this.heldNotes.delete(data1);
        this.pendingNoteOffs.delete(data1);
        this.noteListener?.({ type: "off", midi: data1, velocity: 0, receivedAt });
        break;
      }
      case 0xe0: { // Pitch Bend — 14-bit value split across data1 (LSB) and data2 (MSB)
        const raw = (data2 << 7) | data1;
        // Map 0–16383 to ±2 semitones (standard pitch bend range)
        const semitones = ((raw - 8192) / 8192) * 2;
        this.activeSynth.setPitchBend(semitones);
        break;
      }
      case 0xb0: { // Control Change
        this.handleControlChange(data1, data2);
        break;
      }
        
      default:
        break;
    }
  }

  /**
   * Allows hardware controller knobs or expression wheels to drive synthesis features.
   */
  private handleControlChange(control: number, value: number): void {
    if (!this.activeSynth) return;

    switch (control) {
      case 1: { // Mod Wheel → filter cutoff
        const targetFrequency = 200 + (value / 127) * 5800;
        this.activeSynth.setFilterFreq(targetFrequency);
        break;
      }
      case 64: { // Sustain pedal — >63 = pressed, ≤63 = released
        this.activeSynth.setSustain(value > 63);
        break;
      }
      case 123: { // All Notes Off — sent by some devices on disconnect
        this.activeSynth.allNotesOff();
        break;
      }
    }
  }
}

// Export as a system wide singleton instance matching your context design pattern
export const MidiManager = new MidiHardwareManager();
