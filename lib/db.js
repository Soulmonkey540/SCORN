// lib/db.js
// Conexão com o banco Postgres (Supabase, criado automaticamente pelo Vercel).
// Usamos a biblioteca "pg" (node-postgres), que funciona com qualquer Postgres
// padrão — diferente de "@vercel/postgres", que só funciona com Neon.

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }, // Supabase exige conexão SSL
});

// Mantém a mesma sintaxe "sql`SELECT ...`" usada no resto do código,
// pra não precisar reescrever todas as queries — só troca o motor por baixo.
function sql(strings, ...values) {
    let texto = '';
    strings.forEach((parte, i) => {
        texto += parte;
        if (i < values.length) texto += `$${i + 1}`;
    });
    return pool.query(texto, values);
}

module.exports = { sql, pool };
