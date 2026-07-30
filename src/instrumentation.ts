export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ validateRuntimeEnv }, { runMigrations }] = await Promise.all([
      import("@/lib/env"),
      import("@/db/migrate"),
    ]);
    validateRuntimeEnv();
    runMigrations();
  }
}
