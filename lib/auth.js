// lib/auth.js
// Sessão simples de admin usando JWT em cookie httpOnly.
// Não guarda a senha em lugar nenhum além do hash no banco.

const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'scorn_admin_session';
const SEGREDO = process.env.SESSION_SECRET; // definido nas env vars do Vercel

function criarTokenSessao(admin) {
    return jwt.sign(
        { adminId: admin.id, email: admin.email },
        SEGREDO,
        { expiresIn: '12h' }
    );
}

function cookieDeLogin(token) {
    // 12h em segundos = 43200
    return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}

function cookieDeLogout() {
    return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function lerCookie(request, nome) {
    const raw = request.headers.cookie || '';
    const partes = raw.split(';').map(p => p.trim());
    for (const parte of partes) {
        const [chave, ...resto] = parte.split('=');
        if (chave === nome) return resto.join('=');
    }
    return null;
}

// Middleware simples: valida sessão e retorna o payload, ou lança erro.
function exigirSessaoAdmin(request) {
    const token = lerCookie(request, COOKIE_NAME);
    if (!token) {
        const erro = new Error('Não autenticado');
        erro.status = 401;
        throw erro;
    }
    try {
        return jwt.verify(token, SEGREDO);
    } catch (e) {
        const erro = new Error('Sessão inválida ou expirada');
        erro.status = 401;
        throw erro;
    }
}

module.exports = {
    criarTokenSessao,
    cookieDeLogin,
    cookieDeLogout,
    exigirSessaoAdmin,
};
