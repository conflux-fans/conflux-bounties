import postgres from "postgres";
import { config } from "../lib/config.js";

export const sql = postgres(config.databaseUrl);
