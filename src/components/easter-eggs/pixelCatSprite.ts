// Pixel-art data for the walking cat easter egg. No image assets, canvas, or SVG —
// the sprite is a set of (column, row, color) offsets rendered with the CSS
// box-shadow technique (see PixelCat.tsx).

type Pixel = readonly [col: number, row: number, color: string];

const UNIT = 4;
const GRID_COLS = 16;
const GRID_ROWS = 10;

const COLORS = {
  // Mid-tone slate so the sprite reads clearly on both the light card
  // background and the near-black dark theme (bg-card: #FFFFFF / #212121).
  body: "#8b899a",
  eye: "#f5f5f0",
  nose: "#ff9db3",
} as const;

const EARS: Pixel[] = [
  [10, 0, COLORS.body],
  [12, 0, COLORS.body],
];

const HEAD: Pixel[] = [
  [9, 1, COLORS.body],
  [10, 1, COLORS.body],
  [11, 1, COLORS.body],
  [12, 1, COLORS.body],
  [13, 1, COLORS.body],
  [14, 1, COLORS.body],
  [9, 2, COLORS.body],
  [10, 2, COLORS.body],
  [11, 2, COLORS.body],
  [13, 2, COLORS.body],
  [14, 2, COLORS.body],
  [9, 3, COLORS.body],
  [10, 3, COLORS.body],
  [11, 3, COLORS.body],
  [12, 3, COLORS.body],
  [13, 3, COLORS.body],
  [14, 3, COLORS.body],
];

const FACE: Pixel[] = [
  [12, 2, COLORS.eye],
  [15, 2, COLORS.nose],
];

const BODY: Pixel[] = [
  [3, 3, COLORS.body],
  [4, 3, COLORS.body],
  [5, 3, COLORS.body],
  [6, 3, COLORS.body],
  [7, 3, COLORS.body],
  [8, 3, COLORS.body],
  [3, 4, COLORS.body],
  [4, 4, COLORS.body],
  [5, 4, COLORS.body],
  [6, 4, COLORS.body],
  [7, 4, COLORS.body],
  [8, 4, COLORS.body],
  [3, 5, COLORS.body],
  [4, 5, COLORS.body],
  [5, 5, COLORS.body],
  [6, 5, COLORS.body],
  [7, 5, COLORS.body],
  [8, 5, COLORS.body],
  [4, 6, COLORS.body],
  [5, 6, COLORS.body],
  [6, 6, COLORS.body],
  [7, 6, COLORS.body],
];

const TAIL: Pixel[] = [
  [2, 5, COLORS.body],
  [1, 4, COLORS.body],
  [1, 3, COLORS.body],
  [1, 2, COLORS.body],
  [2, 1, COLORS.body],
  [3, 1, COLORS.body],
];

// Two leg poses swapped via a CSS keyframe animation to create the walk cycle.
const LEGS_A: Pixel[] = [
  [4, 7, COLORS.body],
  [4, 8, COLORS.body],
  [4, 9, COLORS.body],
  [7, 7, COLORS.body],
  [7, 8, COLORS.body],
  [7, 9, COLORS.body],
];

const LEGS_B: Pixel[] = [
  [4, 7, COLORS.body],
  [4, 8, COLORS.body],
  [8, 7, COLORS.body],
  [8, 8, COLORS.body],
  [8, 9, COLORS.body],
];

const STATIC_PIXELS: Pixel[] = [...EARS, ...HEAD, ...FACE, ...BODY, ...TAIL];

function toBoxShadow(pixels: Pixel[]): string {
  return pixels
    .map(([col, row, color]) => `${col * UNIT}px ${row * UNIT}px 0 ${color}`)
    .join(", ");
}

export const CAT_PIXEL_UNIT = UNIT;
export const CAT_WIDTH = GRID_COLS * UNIT;
export const CAT_HEIGHT = GRID_ROWS * UNIT;

export const FRAME_A_SHADOW = toBoxShadow([...STATIC_PIXELS, ...LEGS_A]);
export const FRAME_B_SHADOW = toBoxShadow([...STATIC_PIXELS, ...LEGS_B]);
