import fs from "node:fs";
import path from "node:path";

const dataDirectory = path.resolve("data");
const databasePath = path.join(dataDirectory, "e2e.db");

fs.mkdirSync(dataDirectory, { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  const target = `${databasePath}${suffix}`;
  if (fs.existsSync(target)) fs.unlinkSync(target);
}
