import fs from "node:fs";
import path from "node:path";

const target = path.join("node_modules", "tiklive", "dist", "platform", "node.mjs");
if (!fs.existsSync(target)) {
  console.error("File tiklive yang perlu diperbaiki tidak ditemukan:", target);
  process.exit(1);
}

const source = fs.readFileSync(target, "utf8");
const broken = 'import { NodeWS } from "@effect/platform-node/NodeSocket";';
const fixed = 'import { NodeWS } from "@effect/platform-node";';

if (source.includes(broken)) {
  fs.writeFileSync(target, source.replace(broken, fixed), "utf8");
  console.log("Patch tiklive berhasil diterapkan untuk @effect/platform-node 4.1.x.");
} else if (source.includes(fixed)) {
  console.log("Patch tiklive tidak diperlukan; import NodeWS sudah benar.");
} else {
  console.error("Versi tiklive berbeda dari yang diharapkan. Periksa import NodeWS sebelum deploy.");
  process.exit(1);
}
