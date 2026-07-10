/**
 * Sinh favicon.ico từ logo công ty (assets/2.jpg) — cắt vùng biểu tượng
 * tròn "SR" (bỏ chữ "SARAM GROUP" bên dưới vì quá nhỏ để đọc được ở kích
 * thước tab trình duyệt), rồi đóng gói nhiều kích thước PNG (16/32/48px)
 * vào 1 file .ico hợp lệ theo chuẩn "PNG-in-ICO" (được mọi trình duyệt
 * hiện đại hỗ trợ, không cần thư viện ngoài — chỉ dùng sharp đã có sẵn).
 *
 * Chạy: node scripts/generate-favicon.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, "..", "..", "assets", "2.jpg");
const OUTPUT = path.join(__dirname, "..", "app", "favicon.ico");
const SIZES = [16, 32, 48];

// Vùng chứa đúng biểu tượng tròn "SR", không lẫn dòng chữ "SARAM GROUP".
const CROP = { left: 110, top: 10, width: 710, height: 630 };

async function buildPng(size) {
  // ensureAlpha(): Turbopack yêu cầu PNG nhúng trong .ico phải có kênh RGBA,
  // trong khi ảnh nguồn là JPEG không có kênh alpha.
  return sharp(SOURCE).extract(CROP).resize(size, size).ensureAlpha().png().toBuffer();
}

function buildIco(pngBuffers) {
  const headerSize = 6;
  const entrySize = 16;
  const numImages = pngBuffers.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(numImages, 4);

  const entries = [];
  const imageData = [];
  let offset = headerSize + entrySize * numImages;

  pngBuffers.forEach(({ size, buffer }) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image data size
    entry.writeUInt32LE(offset, 12); // image data offset
    entries.push(entry);
    imageData.push(buffer);
    offset += buffer.length;
  });

  return Buffer.concat([header, ...entries, ...imageData]);
}

async function main() {
  const pngBuffers = await Promise.all(
    SIZES.map(async (size) => ({ size, buffer: await buildPng(size) })),
  );
  const ico = buildIco(pngBuffers);
  fs.writeFileSync(OUTPUT, ico);
  console.log(`Đã tạo favicon.ico (${SIZES.join("/")}px) tại: ${OUTPUT}`);
}

main().catch((error) => {
  console.error("Sinh favicon thất bại:", error);
  process.exit(1);
});
