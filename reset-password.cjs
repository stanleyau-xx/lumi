const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = (process.env.DATABASE_URL || 'file:./data/db.sqlite').replace(/^file:/, '');
const newPassword = process.argv[2];
if (!newPassword) { console.error('Usage: node reset-password.cjs <newpassword>'); process.exit(1); }

const db = new Database(dbPath);
const hash = bcrypt.hashSync(newPassword, 12);
const result = db.prepare("UPDATE users SET password_hash = ? WHERE role = 'admin'").run(hash);
console.log(`Updated ${result.changes} user(s). Password set to: ${newPassword}`);
