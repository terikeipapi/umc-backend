import { readFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
// Reuse the non-destructive member/rating setup and created_at migration.
import './week7-db.mjs';

const connection = await createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  multipleStatements: false,
});
try {
  const schema = await readFile(
    new URL('../sql/week8-favorites.sql', import.meta.url),
    'utf8',
  );
  await connection.query(schema);
  // CREATE TABLE IF NOT EXISTS does not add columns to the earlier schema.
  // Add only missing columns and preserve existing favorite relationships.
  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'favorite' AND COLUMN_NAME IN ('created_at', 'updated_at')",
  );
  const names = new Set(columns.map((column) => column.COLUMN_NAME));
  if (!names.has('created_at')) {
    await connection.query(
      'ALTER TABLE favorite ADD COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
    );
    console.log('Added favorite.created_at; earlier rows use migration time.');
  }
  if (!names.has('updated_at')) {
    await connection.query(
      'ALTER TABLE favorite ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
    );
  }
  console.log('Week 8 favorite table ready. Existing data preserved.');
} finally {
  await connection.end();
}
