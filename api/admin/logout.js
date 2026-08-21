// api/admin/logout.js
const { cookieDeLogout } = require('../../lib/auth');

module.exports = async function handler(request, response) {
    response.setHeader('Set-Cookie', cookieDeLogout());
    return response.status(200).json({ ok: true });
};
