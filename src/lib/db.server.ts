import postgres from "postgres";

const globalForDatabase = globalThis as typeof globalThis & {
  jarsigPostgres?: ReturnType<typeof postgres>;
};

function createDatabaseClient() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("Missing DATABASE_URL. Configure the PostgreSQL connection for JARSIG.");
  }

  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/** Shared PostgreSQL client for server handlers. Never import this from browser code. */
export const db = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, property, receiver) {
    globalForDatabase.jarsigPostgres ??= createDatabaseClient();
    return Reflect.get(globalForDatabase.jarsigPostgres, property, receiver);
  },
});
