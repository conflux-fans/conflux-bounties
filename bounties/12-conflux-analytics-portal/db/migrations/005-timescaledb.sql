/**
 * Migration 005: TimescaleDB hypertable
 * Converts token_transfers to a TimescaleDB hypertable for efficient
 * time-range queries. Gracefully skips if the extension is unavailable.
 */

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

  /**
   * Only convert if the table is not already a hypertable.
   * The timestamp column used is block_number (monotonically increasing).
   */
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables
    WHERE hypertable_name = 'token_transfers'
  ) THEN
    PERFORM create_hypertable(
      'token_transfers',
      'block_number',
      chunk_time_interval => 100000,
      migrate_data => TRUE
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available — skipping hypertable creation: %', SQLERRM;
END $$;
