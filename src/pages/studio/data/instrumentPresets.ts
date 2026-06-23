import type { SynthPreset } from "~/lib/audio/synth";

export type InstrumentCategoryId = "piano" | "lead" | "pad" | "guitar" | "bass";

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
    id: "piano",
    label: "Piano",
    description: "Keys and sampled piano sounds.",
    sounds: [
      { id: "piano", label: "Studio Piano", description: "Clean sampled piano" },
    ],
  },
  {
    id: "lead",
    label: "Lead",
    description: "Melodic synth voices and plucked leads.",
    sounds: [
      { id: "lead", label: "Classic Lead", description: "Bright saw lead" },
      { id: "fm-bell", label: "FM Bell", description: "Bell-like digital lead" },
      { id: "physical-pluck", label: "Pluck", description: "Short plucked lead" },
    ],
  },
  {
    id: "pad",
    label: "Pad",
    description: "Wide sustained synth layers.",
    sounds: [
      { id: "pad", label: "Warm Pad", description: "Soft sustained layer" },
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
    ],
  },
];

export function getInstrumentCategoryForPreset(preset: SynthPreset): InstrumentCategory {
  return INSTRUMENT_CATEGORIES.find((category) =>
    category.sounds.some((sound) => sound.id === preset)
  ) ?? INSTRUMENT_CATEGORIES[0]!;
}
