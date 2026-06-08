import { getAudioContext, unlockAudioContext } from "./context";
import { setConnectedMidiDevices, type SimpleMidiDevice } from "../state/transportStore";
import type { PolySynth } from "./synth";

class MidiHardwareManager {
  private midiAccess: MIDIAccess | null = null;
  private activeSynth: PolySynth | null = null;

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
   */
  bindTargetSynth(synth: PolySynth | null): void {
    this.activeSynth = synth;
  }

  /**
   * Scans attached physical equipment and keeps the SolidJS state store synchronized.
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

      // Bind the native audio thread packet consumer
      dev.onmidimessage = (event: MIDIMessageEvent) => this.handleMidiMessage(event);
    }

    setConnectedMidiDevices(devices);
  }

  /**
   * Parses standard 3-byte hardware MIDI message packets down to frequencies.
   */
  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data || event.data.length < 3 || !this.activeSynth) return;

    const [status, data1, data2] = event.data;
    if (status === undefined || data1 === undefined || data2 === undefined) return;
    const command = status & 0xf0; // Extract command byte type
    // const channel = status & 0x0f; // Extract MIDI channel (0-15) if needed later

    // Ensure the browser AudioContext has been physically unlocked by a gesture
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      unlockAudioContext();
    }

    switch (command) {
      case 0x90: // Note On event packet
        const noteOnMidi = data1;
        const velocity = data2 / 127; // Convert standard 0-127 MIDI value to a 0.0-1.0 float

        if (velocity > 0) {
          this.activeSynth.noteOn(noteOnMidi, velocity);
        } else {
          // A standard MIDI specification quirk: Note On with 0 velocity means Note Off
          this.activeSynth.noteOff(noteOnMidi);
        }
        break;

      case 0x80: // Note Off event packet
        const noteOffMidi = data1;
        this.activeSynth.noteOff(noteOffMidi);
        break;

      case 0xb0: // Control Change (CC) event packet (knobs/faders/mod wheels)
        const controllerNumber = data1;
        const controllerValue = data2;
        this.handleControlChange(controllerNumber, controllerValue);
        break;
        
      default:
        break;
    }
  }

  /**
   * Allows hardware controller knobs or expression wheels to drive synthesis features.
   */
  private handleControlChange(control: number, value: number): void {
    if (!this.activeSynth) return;

    // Standard Mod Wheel mapping
    if (control === 1) {
      // Scale standard 0-127 MIDI space into regular frequency values (e.g., 200Hz to 6000Hz)
      const targetFrequency = 200 + (value / 127) * 5800;
      this.activeSynth.setFilterFreq(targetFrequency);
    }
  }
}

// Export as a system wide singleton instance matching your context design pattern
export const MidiManager = new MidiHardwareManager();