// Generates the Tech Portal's PWA icons into grass_wiz_calendar/icons/.
// No dependencies: draws a pink rounded tile with a blocky "GW" and encodes PNG by hand.
// Run: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'grass_wiz_calendar', 'icons');
const PINK = [216, 27, 96];      // --primary
const WHITE = [255, 255, 255];
const SS = 4;                    // supersample factor (antialiasing)

// 5x7 bitmap glyphs
const GLYPHS = {
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
};

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
const crc32 = b => { let c = 0xFFFFFFFF; for (const byte of b) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function pngChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgba) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
    const raw = Buffer.alloc(h * (1 + w * 4));
    for (let y = 0; y < h; y++) { raw[y * (1 + w * 4)] = 0; rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4); }
    return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

// --- drawing (into a supersampled buffer) ---
function drawIcon(size, { maskable = false } = {}) {
    const W = size * SS;
    const px = Buffer.alloc(W * W * 4);
    const set = (x, y, [r, g, b]) => { const i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
    const M = maskable ? 0 : Math.round(size * 0.03) * SS;
    const R = maskable ? 0 : Math.round(size * 0.18) * SS;

    // pink tile (rounded unless maskable — maskable must bleed to the edges)
    for (let y = M; y < W - M; y++) for (let x = M; x < W - M; x++) {
        if (R) {
            const cx = Math.max(M + R, Math.min(x, W - M - R - 1));
            const cy = Math.max(M + R, Math.min(y, W - M - R - 1));
            if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        }
        set(x, y, PINK);
    }

    // "GW" block letters, centred inside the tile
    const word = 'GW';
    const gap = 2; // glyph columns between letters
    const cols = word.length * 5 + (word.length - 1) * gap;
    const cell = Math.floor(Math.min(size * (maskable ? 0.52 : 0.48) / 7, size * (maskable ? 0.68 : 0.78) / cols)) * SS;
    const wpx = cols * cell, hpx = 7 * cell;
    let ox = Math.floor((W - wpx) / 2), oy = Math.floor((W - hpx) / 2);
    for (const ch of word) {
        GLYPHS[ch].forEach((row, gy) => {
            for (let gx = 0; gx < 5; gx++) if (row[gx] === '1')
                for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++)
                    set(ox + gx * cell + dx, oy + gy * cell + dy, WHITE);
        });
        ox += (5 + gap) * cell;
    }

    // box downsample
    const out = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const acc = [0, 0, 0, 0];
        for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * W + (x * SS + dx)) * 4;
            for (let c = 0; c < 4; c++) acc[c] += px[i + c];
        }
        const o = (y * size + x) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = Math.round(acc[c] / (SS * SS));
    }
    return encodePNG(size, size, out);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
    ['icon-192.png', 192, {}],
    ['icon-512.png', 512, {}],
    ['icon-maskable-192.png', 192, { maskable: true }],
    ['icon-maskable-512.png', 512, { maskable: true }],
    ['apple-touch-icon.png', 180, { maskable: true }], // iOS fills its own mask
];
for (const [name, size, opts] of jobs) {
    fs.writeFileSync(path.join(OUT, name), drawIcon(size, opts));
    console.log('wrote', name, size + 'x' + size);
}
