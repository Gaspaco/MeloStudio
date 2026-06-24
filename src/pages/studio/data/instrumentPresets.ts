import type { SynthPreset } from "~/lib/audio/synth";

export type InstrumentCategoryId = "acoustic-piano" | "electric-keys" | "lead" | "pad-strings" | "guitar" | "bass";

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
    ],
  },
];

export function getInstrumentCategoryForPreset(preset: SynthPreset): InstrumentCategory {
  return INSTRUMENT_CATEGORIES.find((category) =>
    category.sounds.some((sound) => sound.id === preset)
  ) ?? INSTRUMENT_CATEGORIES[0]!;
}
