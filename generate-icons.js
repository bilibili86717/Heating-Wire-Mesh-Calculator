// 生成布丝计算器 PWA 图标 (PNG) - 纯 Node.js，无外部依赖
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function generatePNG(size, draw) {
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const color = draw(x, y);
      if (color) raw.push(color[0], color[1], color[2], 255);
      else raw.push(0, 0, 0, 0);
    }
  }
  const idatData = zlib.deflateSync(Buffer.from(raw));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// 点在圆角矩形内吗？
function inRoundedRect(x, y, size, pad, r) {
  const left = pad, top = pad, right = size - pad - 1, bottom = size - pad - 1;
  if (x < left - 0.5 || x > right + 0.5 || y < top - 0.5 || y > bottom + 0.5) return false;
  // 检查四个角
  if (x < left + r && y < top + r)
    return Math.hypot(x - (left + r), y - (top + r)) <= r;
  if (x > right - r && y < top + r)
    return Math.hypot(x - (right - r), y - (top + r)) <= r;
  if (x < left + r && y > bottom - r)
    return Math.hypot(x - (left + r), y - (bottom - r)) <= r;
  if (x > right - r && y > bottom - r)
    return Math.hypot(x - (right - r), y - (bottom - r)) <= r;
  return true;
}

function drawIcon(x, y, size) {
  const pad = Math.max(2, Math.floor(size * 0.08));
  const r = size * 0.18;
  const cx = size / 2, cy = size / 2;
  if (!inRoundedRect(x, y, size, pad, r)) return null;

  // 深蓝渐变背景
  const t = (x + y) / (2 * size);
  const bgR = Math.round(30 + t * 20);
  const bgG = Math.round(58 + t * 30);
  const bgB = Math.round(95 + t * 40);

  // 中心电阻符号 - 简化为"Ω"图案：上半圆 + 两条水平线
  const centerR = size * 0.28;
  // 上半圆（带粗细）
  const dx = x - cx, dy = y - cy - centerR * 0.2;
  const distFromArc = Math.abs(Math.hypot(dx, dy * 1.3) - centerR * 0.7);
  const arcThickness = Math.max(1.5, size * 0.025);
  if (distFromArc < arcThickness && dy < centerR * 0.3) {
    return [255, 180, 50];
  }
  // 横线 (两条横跨的线)
  if (Math.abs(y - (cy + centerR * 0.4)) < arcThickness &&
      x > cx - centerR * 0.9 && x < cx + centerR * 0.9) return [255, 200, 80];

  // 加热丝：5条波浪橙色线
  const lines = 5;
  const lineGap = (size - 2 * pad) / (lines + 1);
  for (let i = 1; i <= lines; i++) {
    const lineY = pad + i * lineGap;
    const wave = Math.sin((x / size) * Math.PI * 2 + i) * (size * 0.03);
    const dist = Math.abs(y - (lineY + wave));
    const thickness = Math.max(1, size * 0.012);
    if (dist < thickness) {
      const glow = 1 - Math.abs(x - cx) / (size / 2);
      return [245, Math.round(140 + glow * 70), 11];
    }
  }

  return [bgR, bgG, bgB];
}

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

[192, 512].forEach(size => {
  const buf = generatePNG(size, (x, y) => drawIcon(x, y, size));
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), buf);
  console.log(`✓ icons/icon-${size}.png (${buf.length} bytes)`);
});
