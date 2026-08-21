// api/admin/login.js
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const { criarTokenSessao, cookieDeLogin } = require('../../lib/auth');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método não permitido' });
    }

    const { email, senha } = request.body || {};
    if (!email || !senha) {
        return response.status(400).json({ error: 'Informe email e senha' });
    }

    try {
        const resultado = await sql`SELECT * FROM admins WHERE email = ${email};`;
        const admin = resultado.rows[0];

        if (!admin) {
            return response.status(401).json({ error: 'Credenciais inválidas' });
        }

        const senhaOk = await bcrypt.compare(senha, admin.senha_hash);
        if (!senhaOk) {
            return response.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = criarTokenSessao(admin);
        response.setHeader('Set-Cookie', cookieDeLogin(token));
        return response.status(200).json({ ok: true, email: admin.email });

    } catch (error) {
        console.error('Erro no login:', error);
        return response.status(500).json({ error: 'Erro ao fazer login' });
    }
};
