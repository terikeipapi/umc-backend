import { readFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const host = process.env.DB_HOST || 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('week7:db requires a local development database.');
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
  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member' AND COLUMN_NAME = 'created_at'",
  );
  if (!columns.length) {
    const migration = await readFile(
      new URL('../sql/week7-member-created-at.sql', import.meta.url),
      'utf8',
    );
    await connection.query(migration);
    console.log(
      'Added member.created_at; existing members use migration time.',
    );
  } else {
    console.log('member.created_at already exists; schema unchanged.');
  }
  console.log('Week 7 database ready. Existing member/rating data preserved.');
} finally {
  await connection.end();
}
