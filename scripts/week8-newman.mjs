import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';

try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const host = process.env.DB_HOST || 'localhost';
const baseUrl = process.env.WEEK8_WORKBOOK_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1', '::1'].includes(host) || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Collection verification and cleanup require a local development server/database.');
}
const require = createRequire(import.meta.url);
let newman;
const candidates = process.env.NEWMAN_MODULE ? [resolve(process.env.NEWMAN_MODULE)] : ['newman'];
if (!process.env.NEWMAN_MODULE) {
  const cache = '.tmp/npm-cache/_npx';
  for (const directory of await readdir(cache).catch(() => [])) candidates.push(resolve(cache, directory, 'node_modules/newman'));
}
for (const candidate of candidates) {
  try { newman = require(candidate); break; } catch { /* Try another existing local installation. */ }
}
if (!newman) throw new Error('Install Newman locally or set NEWMAN_MODULE to an existing newman module directory.');
const collection = JSON.parse(await readFile('docs/week8/week8.postman_collection.json', 'utf8'));
const summary = await new Promise((complete, reject) => newman.run({ collection, envVar: [{ key: 'baseUrl', value: baseUrl }], reporters: ['cli'], timeoutRequest: 10_000 }, (error, result) => error ? reject(error) : complete(result)));

const values = Object.fromEntries(summary.collection.variables.all().map((item) => [item.key, item.value]));
// Newman preserves the original Collection object in its summary; variables
// mutated by the sandbox are not guaranteed to be reflected there. Use the
// executed signup/login requests and responses as the cleanup source of truth.
for (const execution of summary.run.executions) {
  const suffix = /^(01|02) /.test(execution.item.name) ? 'A' : /^(03|04) /.test(execution.item.name) ? 'B' : null;
  if (!suffix) continue;
  let requestBody;
  let responseBody;
  try { requestBody = JSON.parse(execution.request.body?.raw); responseBody = JSON.parse(execution.response.stream.toString()); } catch { continue; }
  if (/^(01|03) /.test(execution.item.name) && execution.response.code === 201) {
    values[`email${suffix}`] = requestBody.email;
    values[`memberId${suffix}`] = responseBody.result.memberId;
    values.demoPassword = requestBody.password;
  }
  if (/^(02|04) /.test(execution.item.name) && execution.response.code === 200) values[`token${suffix}`] = responseBody.result.accessToken;
}
const secretValues = ['tokenA', 'tokenB', 'demoPassword'].map((key) => values[key]).filter(Boolean);
function sanitized(value) {
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|accessToken|refreshToken|authorization/i.test(key) ? '[REDACTED]' : sanitized(item)]));
  if (typeof value === 'string') {
    let result = value;
    for (const secret of secretValues) result = result.split(secret).join('[REDACTED]');
    return result;
  }
  return value;
}
const cleanup = { members: 0, favorites: 0, ratings: 0 };
const connection = await createConnection({ host, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME });
try {
  await connection.beginTransaction();
  for (const suffix of ['A', 'B']) {
    const email = values[`email${suffix}`];
    if (!email) continue;
    assert.match(email, /^postman8-[0-9a-f]{7}-[ab]@example\.com$/);
    const [rows] = await connection.execute('SELECT member_id FROM member WHERE email = ? FOR UPDATE', [email]);
    if (!rows.length) continue;
    assert.equal(rows.length, 1);
    const memberId = Number(rows[0].member_id);
    if (values[`memberId${suffix}`]) assert.equal(memberId, Number(values[`memberId${suffix}`]));
    for (const table of ['favorite', 'rating']) {
      const [deleted] = await connection.execute(`DELETE FROM ${table} WHERE member_id = ?`, [memberId]);
      cleanup[table === 'favorite' ? 'favorites' : 'ratings'] += deleted.affectedRows;
    }
    const [deleted] = await connection.execute('DELETE FROM member WHERE member_id = ? AND email = ?', [memberId, email]);
    assert.equal(deleted.affectedRows, 1);
    cleanup.members += deleted.affectedRows;
  }
  await connection.commit();
} catch (error) { await connection.rollback(); throw error; }
finally { await connection.end(); }

const executions = summary.run.executions.map((execution) => {
  let response;
  try { response = JSON.parse(execution.response.stream.toString()); } catch { response = null; }
  let body;
  try { body = JSON.parse(execution.request.body?.raw); } catch { body = undefined; }
  return {
    name: execution.item.name,
    request: { method: execution.request.method, url: execution.request.url.toString(), ...(body ? { body } : {}) },
    response: { status: execution.response?.code, body: response },
    assertions: (execution.assertions || []).map((entry) => ({ assertion: entry.assertion, passed: !entry.error, ...(entry.error ? { error: entry.error.message } : {}) })),
  };
});
const report = sanitized({ verifiedAt: new Date().toISOString(), source: 'Postman Collection executed by the actual Newman runtime, not Postman desktop UI.', stats: summary.run.stats, failures: summary.run.failures.map((entry) => ({ source: entry.source?.name, message: entry.error?.message })), cleanup, executions });
await mkdir('output/week8-workbook', { recursive: true });
await writeFile('output/week8-workbook/newman-results.json', `${JSON.stringify(report, null, 2)}\n`);
assert.equal(summary.run.failures.length, 0, 'Every Newman request and assertion must pass.');
assert.equal(cleanup.members, 2, 'Both exact Postman demo members should be cleaned after the run.');
console.log(`Workbook Postman Collection passed: ${summary.run.stats.requests.total} requests, ${summary.run.stats.assertions.total} assertions; sanitized report saved and exact test accounts removed.`);
