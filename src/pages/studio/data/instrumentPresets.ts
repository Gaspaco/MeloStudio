import type { SynthPreset } from "~/lib/audio/synth";

export type InstrumentCategoryId = "acoustic-piano" | "electric-keys" | "mallets" | "wind-brass" | "lead" | "pad-strings" | "guitar" | "bass" | "drum-kits";

export type InstrumentSound = {
  id: SynthPreset;
  label: string;
  description: string;
};

export type InstrumentCategory = {
  id: InstrumentCategoryId;
  label: string;
  description: string;
  sounds: InstrumentSound[];
};

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  {
    id: "acoustic-piano",
    label: "Acoustic Pianos",
    description: "Velocity-sensitive multisampled acoustic pianos.",
    sounds: [
      { id: "piano", label: "Studio Piano", description: "Clean sampled piano" },
      { id: "bright-piano", label: "Bright Grand", description: "Present concert piano" },
    ],
  },
  {
    id: "electric-keys",
    label: "Electric Keys",
    description: "Electric piano and organ patches.",
    sounds: [
      { id: "electric-piano", label: "Stage EP", description: "Rounded tine-style keys" },
      { id: "organ", label: "Tonewheel Organ", description: "Sustained drawbar-style organ" },
      { id: "clavinet", label: "Clavinet", description: "Bright, plucked electric keyboard" },
      { id: "reed-organ", label: "Reed Organ", description: "Air-driven pump organ" },
    ],
  },
  {
    id: "mallets",
    label: "Mallets & Bells",
    description: "Struck melodic percussion instruments.",
    sounds: [
      { id: "vibraphone", label: "Vibraphone", description: "Warm metal bars with tremolo" },
      { id: "marimba", label: "Marimba", description: "Wooden bars with short decay" },
      { id: "bells", label: "Tubular Bells", description: "Large resonating chimes" },
    ],
  },
  {
    id: "wind-brass",
    label: "Wind & Brass",
    description: "Air-blown instruments.",
    sounds: [
      { id: "flute", label: "Flute", description: "Soft, breathy woodwind" },
      { id: "brass", label: "Synth Brass", description: "Thick, analog brass ensemble" },
    ],
  },
  {
    id: "lead",
    label: "Lead",
    description: "Melodic synth voices and plucked leads.",
    sounds: [
      { id: "lead", label: "Classic Lead", description: "Bright saw lead" },
      { id: "analog-lead", label: "Analog Lead", description: "Wide square lead" },
      { id: "pulse-lead", label: "Pulse Lead", description: "Focused pulse-wave lead" },
      { id: "fm-bell", label: "Digital Bell", description: "Clear percussive bell" },
      { id: "physical-pluck", label: "Plucked String", description: "Fast articulated pluck" },
    ],
  },
  {
    id: "pad-strings",
    label: "Pads & Strings",
    description: "Sustained layers for harmony and atmosphere.",
    sounds: [
      { id: "pad", label: "Warm Pad", description: "Soft sustained layer" },
      { id: "glass-pad", label: "Glass Pad", description: "Airy harmonic layer" },
      { id: "string-ensemble", label: "String Ensemble", description: "Slow orchestral-style strings" },
      { id: "warm-strings", label: "Warm Strings", description: "Rich, analog string section" },
      { id: "space-pad", label: "Space Pad", description: "Evolving, atmospheric texture" },
      { id: "choir", label: "Choir", description: "Synthesized vocal ensemble" },
    ],
  },
  {
    id: "guitar",
    label: "Guitar",
    description: "Picked and strummed guitar sounds.",
    sounds: [
      { id: "guitar", label: "Acoustic Guitar", description: "Sampled acoustic guitar" },
    ],
  },
  {
    id: "bass",
    label: "Bass",
    description: "Low-end keyboard instruments.",
    sounds: [
      { id: "bass", label: "Electric Bass", description: "Sampled electric bass" },
      { id: "synth-bass", label: "Analog Bass", description: "Filtered saw bass" },
      { id: "sub-bass", label: "Sub Bass", description: "Clean sine low end" },
      { id: "wobble-bass", label: "Wobble Bass", description: "Modulated dubstep bass" },
      { id: "acid-bass", label: "Acid Bass", description: "Squuelchy resonant bass" },
    ],
  },
  {
    id: "drum-kits",
    label: "Drum Kits",
    description: "Playable drum kits mapped across the keyboard.",
    sounds: [
      { id: "drum-kit-electronic", label: "Electronic Kit", description: "Modern electronic drums" },
      { id: "drum-kit-acoustic", label: "Acoustic Kit", description: "Natural drum sounds" },
      { id: "drum-kit-808", label: "808 Kit", description: "Classic analog drum machine" },
      { id: "drum-kit-vinyl", label: "Vinyl Kit", description: "Lo-fi sampled drum breaks" },
      { id: "drum-kit-orchestra", label: "Orchestral Kit", description: "Cinematic percussion" },
    ],
  },
];

export function getInstrumentCategoryForPreset(preset: SynthPreset): InstrumentCategory {
  const category = INSTRUMENT_CATEGORIES.find((item) =>
    item.sounds.some((sound) => sound.id === preset)
  );
  if (category) return category;

  const fallback = INSTRUMENT_CATEGORIES[0];
  if (!fallback) throw new Error("At least one instrument category is required.");
  return fallback;
}
