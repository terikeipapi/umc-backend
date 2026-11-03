import { readFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const host = process.env.DB_HOST || 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('week6:db requires a local development database.');
}
if (!process.env.DB_NAME) throw new Error('Set DB_NAME in .env first.');

const connection = await createConnection({
  host,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  multipleStatements: false,
});
try {
  const schema = await readFile(
    new URL('../sql/week6-schema.sql', import.meta.url),
    'utf8',
  );
  for (const statement of schema
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    await connection.query(statement);
  }
  console.log(
    'Week 6 member/rating tables ready. Existing tables and rows were preserved.',
  );
} finally {
  await connection.end();
}
