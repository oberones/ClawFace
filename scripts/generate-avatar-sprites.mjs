import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const FRAME_SIZE = 24;
const COLUMNS = 4;
const ROWS = 10;
const WIDTH = FRAME_SIZE * COLUMNS;
const HEIGHT = FRAME_SIZE * ROWS;
const OUTPUT_DIR = path.resolve("public/avatars");

const STATE_ROWS = [
  "idle",
  "thinking",
  "streaming",
  "tool-running",
  "success",
  "serious",
  "caution",
  "warning",
  "approval-needed",
  "disconnected",
];

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(filePath, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * (WIDTH * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND"),
  ]);
  fs.writeFileSync(filePath, png);
}

function makeCanvas() {
  return Buffer.alloc(WIDTH * HEIGHT * 4);
}

function rgba(hex, alpha = 255) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
    return;
  }
  const offset = (y * WIDTH + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function rect(pixels, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      setPixel(pixels, px, py, color);
    }
  }
}

function line(pixels, x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    setPixel(pixels, x, y, color);
    if (x === x1 && y === y1) {
      break;
    }
    const e2 = error * 2;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function outlineRect(pixels, x, y, w, h, color) {
  rect(pixels, x, y, w, 1, color);
  rect(pixels, x, y + h - 1, w, 1, color);
  rect(pixels, x, y, 1, h, color);
  rect(pixels, x + w - 1, y, 1, h, color);
}

function diamond(pixels, cx, cy, radius, fill, outline) {
  for (let y = -radius; y <= radius; y += 1) {
    const span = radius - Math.abs(y);
    rect(pixels, cx - span, cy + y, span * 2 + 1, 1, fill);
  }
  line(pixels, cx, cy - radius, cx + radius, cy, outline);
  line(pixels, cx + radius, cy, cx, cy + radius, outline);
  line(pixels, cx, cy + radius, cx - radius, cy, outline);
  line(pixels, cx - radius, cy, cx, cy - radius, outline);
}

function dot(pixels, x, y, color) {
  rect(pixels, x, y, 2, 2, color);
}

function frameOrigin(row, frame) {
  return {
    x: frame * FRAME_SIZE,
    y: row * FRAME_SIZE,
  };
}

function drawNeonBase(pixels, ox, oy, frame, mood) {
  const outline = rgba("#07151f");
  const shell = rgba("#14283a");
  const bevel = rgba("#264967");
  const screen = rgba("#0b101c");
  const cyan = rgba("#42f2ff");
  const blue = rgba("#3088ff");
  const magenta = rgba("#ff4fd8");
  const amber = rgba("#ffc247");
  const red = rgba("#ff4f65");
  const green = rgba("#63ff9b");
  const bob = mood === "streaming" || mood === "success" ? frame % 2 : 0;

  rect(pixels, ox + 8, oy + 2 + bob, 8, 2, outline);
  rect(pixels, ox + 10, oy + 1 + bob, 4, 2, cyan);
  rect(pixels, ox + 4, oy + 5 + bob, 16, 14, outline);
  rect(pixels, ox + 5, oy + 6 + bob, 14, 12, shell);
  rect(pixels, ox + 6, oy + 7 + bob, 12, 2, bevel);
  rect(pixels, ox + 7, oy + 10 + bob, 10, 5, screen);
  rect(pixels, ox + 6, oy + 18 + bob, 12, 2, outline);
  rect(pixels, ox + 8, oy + 20 + bob, 8, 1, outline);
  dot(pixels, ox + 6, oy + 16 + bob, blue);
  dot(pixels, ox + 16, oy + 16 + bob, magenta);

  if (mood === "idle") {
    rect(pixels, ox + 9, oy + 11 + bob, 5, 1, cyan);
    if (frame % 2 === 0) {
      rect(pixels, ox + 15, oy + 11 + bob, 1, 3, green);
    }
  }
  if (mood === "thinking") {
    const dots = [[8, 3], [12, 2], [16, 3], [18, 6]];
    dots.forEach(([dx, dy], index) => {
      dot(pixels, ox + dx, oy + dy, index === frame ? amber : cyan);
    });
    rect(pixels, ox + 10, oy + 11 + bob, 4, 1, cyan);
  }
  if (mood === "streaming") {
    for (let i = 0; i < 3; i += 1) {
      rect(pixels, ox + 8, oy + 10 + i * 2 + bob, 3 + ((frame + i) % 4), 1, i === 1 ? green : cyan);
    }
  }
  if (mood === "tool-running") {
    const cx = ox + 12;
    const cy = oy + 12 + bob;
    outlineRect(pixels, cx - 3, cy - 3, 7, 7, cyan);
    rect(pixels, cx, cy - 5 + (frame % 2), 1, 3, amber);
    rect(pixels, cx, cy + 3 - (frame % 2), 1, 3, amber);
    rect(pixels, cx - 5 + (frame % 2), cy, 3, 1, amber);
    rect(pixels, cx + 3 - (frame % 2), cy, 3, 1, amber);
  }
  if (mood === "success") {
    line(pixels, ox + 8, oy + 13 + bob, ox + 11, oy + 16 + bob, green);
    line(pixels, ox + 11, oy + 16 + bob, ox + 17, oy + 9 + bob, green);
  }
  if (mood === "serious") {
    rect(pixels, ox + 8, oy + 12 + bob, 8, 1, cyan);
    rect(pixels, ox + 10, oy + 15 + bob, 4, 1, blue);
  }
  if (mood === "caution") {
    line(pixels, ox + 12, oy + 8 + bob, ox + 17, oy + 16 + bob, amber);
    line(pixels, ox + 12, oy + 8 + bob, ox + 7, oy + 16 + bob, amber);
    rect(pixels, ox + 8, oy + 16 + bob, 9, 1, amber);
    rect(pixels, ox + 12, oy + 11 + bob, 1, 3, amber);
  }
  if (mood === "warning") {
    line(pixels, ox + 8, oy + 9 + bob, ox + 16, oy + 17 + bob, red);
    line(pixels, ox + 16, oy + 9 + bob, ox + 8, oy + 17 + bob, red);
  }
  if (mood === "approval-needed") {
    outlineRect(pixels, ox + 8, oy + 10 + bob, 9, 6, amber);
    rect(pixels, ox + 10, oy + 12 + bob, 5, 1, green);
    dot(pixels, ox + 17, oy + 13 + bob, amber);
  }
  if (mood === "disconnected") {
    rect(pixels, ox + 8, oy + 11 + bob, 3, 2, red);
    rect(pixels, ox + 14, oy + 11 + bob, 3, 2, red);
    line(pixels, ox + 11, oy + 13 + bob, ox + 13, oy + 10 + bob, red);
  }
}

function drawPrismBase(pixels, ox, oy, frame, mood) {
  const outline = rgba("#241838");
  const shadow = rgba("#342858");
  const violet = rgba("#8157ff");
  const cyan = rgba("#54e7ff");
  const mint = rgba("#86ffc8");
  const amber = rgba("#ffd166");
  const red = rgba("#ff5c7a");
  const blue = rgba("#5f9dff");
  const bob = mood === "thinking" || mood === "streaming" ? frame % 2 : 0;
  const cx = ox + 12;
  const cy = oy + 12 + bob;

  diamond(pixels, cx, cy, 9, shadow, outline);
  diamond(pixels, cx, cy, 6, violet, cyan);
  rect(pixels, cx - 2, cy - 2, 5, 5, rgba("#11182a"));
  dot(pixels, cx - 1, cy - 1, mint);

  if (mood === "idle") {
    rect(pixels, cx - 1, cy + 3, 3 + (frame % 2), 1, cyan);
  }
  if (mood === "thinking") {
    const orbit = [[cx, cy - 10], [cx + 8, cy - 1], [cx, cy + 9], [cx - 8, cy - 1]];
    orbit.forEach(([x, y], index) => dot(pixels, x - 1, y - 1, index === frame ? amber : cyan));
  }
  if (mood === "streaming") {
    for (let i = 0; i < 3; i += 1) {
      line(pixels, ox + 6, oy + 8 + i * 3, ox + 17 - ((frame + i) % 3), oy + 8 + i * 3, i === 1 ? mint : cyan);
    }
  }
  if (mood === "tool-running") {
    const points = [[cx, cy - 8], [cx + 8, cy], [cx, cy + 8], [cx - 8, cy]];
    points.forEach(([x, y], index) => {
      const active = (index + frame) % 4 === 0;
      rect(pixels, x - 1, y - 1, 3, 3, active ? amber : cyan);
    });
  }
  if (mood === "success") {
    line(pixels, ox + 7, oy + 13 + bob, ox + 11, oy + 17 + bob, mint);
    line(pixels, ox + 11, oy + 17 + bob, ox + 18, oy + 8 + bob, mint);
  }
  if (mood === "serious") {
    rect(pixels, cx - 1, cy - 6, 2, 12, blue);
    rect(pixels, cx - 4, cy, 8, 1, rgba("#152642"));
  }
  if (mood === "caution") {
    line(pixels, cx, cy - 8, cx + 6, cy + 5, amber);
    line(pixels, cx, cy - 8, cx - 6, cy + 5, amber);
    rect(pixels, cx - 5, cy + 5, 11, 1, amber);
    rect(pixels, cx, cy - 2, 1, 5, amber);
  }
  if (mood === "warning") {
    line(pixels, cx - 5, cy - 6, cx + 3, cy + 5, red);
    line(pixels, cx + 4, cy - 5, cx - 3, cy + 6, red);
  }
  if (mood === "approval-needed") {
    outlineRect(pixels, cx - 5, cy - 2, 10, 7, amber);
    rect(pixels, cx - 3, cy, 6, 1, mint);
    rect(pixels, cx - 1, cy - 5, 3, 4, amber);
  }
  if (mood === "disconnected") {
    line(pixels, cx - 6, cy - 3, cx - 1, cy + 3, red);
    line(pixels, cx + 1, cy - 3, cx + 6, cy + 3, red);
    rect(pixels, cx - 1, cy - 7, 2, 2, red);
  }
}

function drawSheet(drawFrame) {
  const pixels = makeCanvas();
  STATE_ROWS.forEach((state, row) => {
    for (let frame = 0; frame < COLUMNS; frame += 1) {
      const { x, y } = frameOrigin(row, frame);
      drawFrame(pixels, x, y, frame, state);
    }
  });
  return pixels;
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
writePng(
  path.join(OUTPUT_DIR, "clawface-neon-console.png"),
  drawSheet(drawNeonBase),
);
writePng(
  path.join(OUTPUT_DIR, "clawface-prism-node.png"),
  drawSheet(drawPrismBase),
);
