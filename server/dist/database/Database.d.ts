import BetterSqlite3 from "better-sqlite3";
/**
 * Thin wrapper around better-sqlite3 with WAL mode,
 * automatic directory creation, and migration support.
 */
export declare class Database {
    readonly db: BetterSqlite3.Database;
    private readonly logger;
    constructor(dbPath: string);
    /** Run all schema migrations */
    migrate(): void;
    /** Create all required tables if they don't exist */
    private createTables;
    /**
     * Prune metrics older than the given number of days.
     * Called periodically to keep the database size manageable.
     */
    pruneMetrics(retentionDays: number): number;
    /** Close the database connection */
    close(): void;
}
//# sourceMappingURL=Database.d.ts.map