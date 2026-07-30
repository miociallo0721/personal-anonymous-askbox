import fs from "node:fs";
import path from "node:path";

const temporaryDirectory = path.resolve(".tmp");
const databaseFiles = ["e2e.db", "e2e.db-shm", "e2e.db-wal"];

fs.mkdirSync(temporaryDirectory, { recursive: true });
for (const filename of databaseFiles) {
  fs.rmSync(path.join(temporaryDirectory, filename), { force: true });
}
