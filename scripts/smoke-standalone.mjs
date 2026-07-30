import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const standaloneDirectory = path.join(workspace, ".next", "standalone");
const temporaryDirectory = path.join(workspace, ".tmp");
const databasePath = path.join(temporaryDirectory, "standalone.db");
const port = 3200;
const origin = `http://127.0.0.1:${port}`;

if (!databasePath.startsWith(workspace)) {
  throw new Error("Standalone database path escaped the workspace");
}

fs.mkdirSync(temporaryDirectory, { recursive: true });
for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${databasePath}${suffix}`, { force: true });
}
fs.cpSync(path.join(workspace, "drizzle"), path.join(standaloneDirectory, "drizzle"), {
  recursive: true,
  force: true,
});

const environment = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  ADMIN_PASSWORD: "standalone-admin-password",
  SESSION_SECRET: "standalone-session-secret-at-least-32-characters",
  IP_HASH_SECRET: "standalone-ip-hash-secret-at-least-32-characters",
  TELEGRAM_BOT_TOKEN: "standalone-not-used",
  TELEGRAM_CHAT_ID: "1",
  ADMIN_PUBLIC_URL: "https://ask.akiyamamio.one/admin",
  TURNSTILE_ENABLED: "false",
  TRUST_CLOUDFLARE_PROXY: "false",
  TRUST_PROXY: "true",
  EXTERNAL_SERVICES_MOCK: "false",
  PORT: String(port),
  HOSTNAME: "127.0.0.1",
};

function startServer() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneDirectory,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[standalone] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[standalone] ${chunk}`));
  return child;
}

async function waitForHealthy(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Standalone server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`);
      const body = await response.json();
      if (response.ok && body.ok && body.status === "healthy") return;
    } catch {
      // The socket is expected to be unavailable while the server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Standalone health check timed out");
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 10_000)),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
    throw new Error("Standalone server did not stop within 10 seconds");
  }
}

let server;
try {
  server = startServer();
  await waitForHealthy(server);

  const submission = await fetch(`${origin}/api/questions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({
      content: "Standalone 持久化验证问题",
      website: "",
      turnstileToken: "",
    }),
  });
  if (submission.status !== 201) {
    throw new Error(`Unexpected standalone submission status: ${submission.status}`);
  }

  await stopServer(server);
  server = startServer();
  await waitForHealthy(server);

  const database = new Database(databasePath, { readonly: true });
  const savedQuestion = database
    .prepare("select count(*) as count from questions where content = ?")
    .get("Standalone 持久化验证问题");
  const modelTables = database
    .prepare(
      "select count(*) as count from sqlite_master where type = 'table' and name in ('answers', 'cards')",
    )
    .get();
  database.close();

  if (savedQuestion.count !== 1 || modelTables.count !== 2) {
    throw new Error("Standalone persistence or migration verification failed");
  }
  console.info(
    JSON.stringify({
      healthy: true,
      submissionStatus: submission.status,
      persistedQuestions: savedQuestion.count,
      modelTables: modelTables.count,
      restartRecovery: true,
      gracefulShutdown: true,
    }),
  );
} finally {
  if (server) await stopServer(server);
}
