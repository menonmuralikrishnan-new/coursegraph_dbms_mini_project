import fs from 'node:fs/promises';
import { sql } from './db.js';
const file = new URL('../sql/001_init.sql', import.meta.url);
await sql.query(await fs.readFile(file, 'utf8'));
await sql.end();
console.log('Database migrated');
