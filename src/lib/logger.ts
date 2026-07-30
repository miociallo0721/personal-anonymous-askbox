type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, boolean | number | string | null | undefined>;

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export const logger = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};

export function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "unknown")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 300);
}
