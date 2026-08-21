// api/produtos.js
// Rota pública usada pela loja (script.js). Continua igual ao original:
// só mostra produtos com estoque disponível.

const { sql } = require('../lib/db');

module.exports = async function handler(request, response) {
  try {
    const result = await sql`SELECT * FROM produtos WHERE estoque_total > 0;`;
    return response.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return response.status(500).json({ error: "Erro ao buscar produtos" });
  }
};