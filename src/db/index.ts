import { drizzle } from "drizzle-orm/neon-serverless";
import { ResilientPool } from "./resilient-pool";
import * as schema from "./schema";

// The WebSocket driver (not neon-http) because the poll state machine needs
// interactive transactions with row locks. Node 22+ ships a global WebSocket.
// ResilientPool retries a failed connection open once (see its notes).
const pool = new ResilientPool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema, casing: "snake_case" });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
