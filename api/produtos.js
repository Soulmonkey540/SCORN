import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    // Busca todos os produtos onde o estoque é maior que zero
    const result = await sql`SELECT * FROM produtos WHERE estoque_total > 0;`;
    return response.status(200).json(result.rows);
  } catch (error) {
    return response.status(500).json({ error: "Erro ao buscar produtos" });
  }
}