import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }

  const dbPath = path.join(process.cwd(), 'database.sqlite');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      stripe_customer_id TEXT,
      is_premium BOOLEAN DEFAULT 0
    );
  `);

  return db;
}

export async function getUser(email: string) {
  const database = await getDb();
  return database.get('SELECT * FROM users WHERE email = ?', email);
}

export async function createUser(email: string, stripeCustomerId?: string, isPremium: boolean = false) {
  const database = await getDb();
  const result = await database.run(
    'INSERT INTO users (email, stripe_customer_id, is_premium) VALUES (?, ?, ?)',
    email, stripeCustomerId, isPremium ? 1 : 0
  );
  return { id: result.lastID, email, stripe_customer_id: stripeCustomerId, is_premium: isPremium ? 1 : 0 };
}

export async function updateUserPremiumStatus(stripeCustomerId: string, isPremium: boolean) {
  const database = await getDb();
  await database.run(
    'UPDATE users SET is_premium = ? WHERE stripe_customer_id = ?',
    isPremium ? 1 : 0, stripeCustomerId
  );
}

export async function updateUserStripeId(email: string, stripeCustomerId: string) {
  const database = await getDb();
  await database.run(
    'UPDATE users SET stripe_customer_id = ? WHERE email = ?',
    stripeCustomerId, email
  );
}
