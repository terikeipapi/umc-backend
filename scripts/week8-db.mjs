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
  console.log('Week 8 favorite table ready. Existing data preserved.');
} finally {
  await connection.end();
}
