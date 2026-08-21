// api/admin/produtos.js
// CRUD de produtos para o dashboard de admin.
// GET    -> lista TODOS os produtos (inclusive com estoque zerado)
// POST   -> cria produto novo
// PUT    -> edita produto existente (precisa de "id" no body)
// DELETE -> remove produto (precisa de "id" na query string: ?id=5)
//
// Todas as rotas exigem sessão de admin válida (cookie).

const { sql } = require('@vercel/postgres');
const { exigirSessaoAdmin } = require('../../lib/auth');

module.exports = async function handler(request, response) {
    try {
        exigirSessaoAdmin(request);
    } catch (erro) {
        return response.status(erro.status || 401).json({ error: erro.message });
    }

    try {
        if (request.method === 'GET') {
            const resultado = await sql`SELECT * FROM produtos ORDER BY id DESC;`;
            return response.status(200).json(resultado.rows);
        }

        if (request.method === 'POST') {
            const { nome, tipo, preco, tamanhos, destaque, novidade, img, estoque_total } = request.body || {};

            if (!nome || !tipo || preco === undefined || !Array.isArray(tamanhos)) {
                return response.status(400).json({ error: 'Campos obrigatórios: nome, tipo, preco, tamanhos (array)' });
            }

            const resultado = await sql`
                INSERT INTO produtos (nome, tipo, preco, tamanhos, destaque, novidade, img, estoque_total)
                VALUES (
                    ${nome}, ${tipo}, ${preco}, ${tamanhos},
                    ${!!destaque}, ${!!novidade}, ${img || null}, ${estoque_total || 0}
                )
                RETURNING *;
            `;
            return response.status(201).json(resultado.rows[0]);
        }

        if (request.method === 'PUT') {
            const { id, nome, tipo, preco, tamanhos, destaque, novidade, img, estoque_total } = request.body || {};

            if (!id) {
                return response.status(400).json({ error: 'Campo "id" é obrigatório' });
            }

            const resultado = await sql`
                UPDATE produtos SET
                    nome = ${nome},
                    tipo = ${tipo},
                    preco = ${preco},
                    tamanhos = ${tamanhos},
                    destaque = ${!!destaque},
                    novidade = ${!!novidade},
                    img = ${img || null},
                    estoque_total = ${estoque_total}
                WHERE id = ${id}
                RETURNING *;
            `;

            if (resultado.rows.length === 0) {
                return response.status(404).json({ error: 'Produto não encontrado' });
            }
            return response.status(200).json(resultado.rows[0]);
        }

        if (request.method === 'DELETE') {
            const { id } = request.query;
            if (!id) {
                return response.status(400).json({ error: 'Parâmetro "id" é obrigatório' });
            }

            await sql`DELETE FROM produtos WHERE id = ${id};`;
            return response.status(200).json({ ok: true });
        }

        return response.status(405).json({ error: 'Método não permitido' });

    } catch (error) {
        console.error('Erro na API de produtos (admin):', error);
        return response.status(500).json({ error: 'Erro ao processar requisição' });
    }
};
