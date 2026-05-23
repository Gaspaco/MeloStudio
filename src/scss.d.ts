declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.scss" {
  const content: string;
  export default content;
}

declare module "color-thief-browser" {
  export default class ColorThief {
    getColor(img: HTMLImageElement, quality?: number): [number, number, number];
    getPalette(img: HTMLImageElement, colorCount?: number, quality?: number): [number, number, number][];
  }
}

declare module "*.mp3" {
  const src: string;
  export default src;
}
