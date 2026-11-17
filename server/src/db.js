import 'dotenv/config';
import pg from 'pg';
import { MongoClient } from 'mongodb';

const { Pool } = pg;
export const sql = new Pool({ connectionString: process.env.POSTGRES_URL });
export const mongoClient = new MongoClient(process.env.MONGO_URL);
export async function mongoDb() { await mongoClient.connect(); return mongoClient.db(process.env.MONGO_DB || 'coursegraph'); }
