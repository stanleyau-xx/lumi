const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = (process.env.DATABASE_URL || 'file:./data/db.sqlite').replace(/^file:/, '');
console.log('Reading DB from:', path.resolve(dbPath));

const db = new Database(dbPath);
const users = db.prepare("SELECT id, username, role, password_hash FROM users").all();
console.log("Users found:", users.length);
users.forEach(u => {
  console.log(` - username: "${u.username}", role: ${u.role}`);
  if (process.argv[2]) {
    const valid = bcrypt.compareSync(process.argv[2], u.password_hash);
    console.log(`   password "${process.argv[2]}" matches: ${valid}`);
  }
});
