// api/checkout.js
// Recebe o carrinho + dados do cliente, valida os produtos e preços
// NO BANCO (nunca confia no preço vindo do navegador), cria o pedido
// com status "aguardando_pix" e gera a cobrança PIX no Mercado Pago.

const { sql } = require('../lib/db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { gerarNumeroPedido } = require('../lib/pedido');

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método não permitido' });
    }

    const { itensIds, nomeCliente, telefoneCliente, enderecoEntrega, emailCliente } = request.body || {};

    if (!Array.isArray(itensIds) || itensIds.length === 0) {
        return response.status(400).json({ error: 'Carrinho vazio' });
    }
    if (!nomeCliente || !telefoneCliente || !enderecoEntrega) {
        return response.status(400).json({ error: 'Nome, telefone e endereço de entrega são obrigatórios' });
    }

    try {
        // Conta quantas vezes cada produto aparece no carrinho (permite repetição)
        const contagem = {};
        for (const id of itensIds) contagem[id] = (contagem[id] || 0) + 1;
        const idsUnicos = Object.keys(contagem).map(Number);

        // Busca os produtos reais no banco — NUNCA confiar no preço do frontend
        const resultadoProdutos = await sql`
            SELECT * FROM produtos WHERE id = ANY(${idsUnicos});
        `;
        const produtosDb = resultadoProdutos.rows;

        if (produtosDb.length !== idsUnicos.length) {
            return response.status(400).json({ error: 'Um ou mais produtos não foram encontrados' });
        }

        // Verifica estoque disponível
        for (const produto of produtosDb) {
            const quantidadePedida = contagem[produto.id];
            if (produto.estoque_total < quantidadePedida) {
                return response.status(409).json({ error: `Estoque insuficiente para "${produto.nome}"` });
            }
        }

        const total = produtosDb.reduce((acc, p) => acc + Number(p.preco) * contagem[p.id], 0);
        const numeroPedido = gerarNumeroPedido();

        // Cria o pedido
        const pedidoCriado = await sql`
            INSERT INTO pedidos (numero_pedido, nome_cliente, telefone_cliente, endereco_entrega, total, status)
            VALUES (${numeroPedido}, ${nomeCliente}, ${telefoneCliente}, ${enderecoEntrega}, ${total}, 'aguardando_pix')
            RETURNING id;
        `;
        const pedidoId = pedidoCriado.rows[0].id;

        // Cria os itens do pedido (snapshot de nome/preço no momento da compra)
        for (const produto of produtosDb) {
            const quantidade = contagem[produto.id];
            await sql`
                INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
                VALUES (${pedidoId}, ${produto.id}, ${produto.nome}, ${produto.preco}, ${quantidade});
            `;
        }

        // Gera a cobrança PIX no Mercado Pago
        const payment = new Payment(mpClient);
        const pagamentoMp = await payment.create({
            body: {
                transaction_amount: Number(total.toFixed(2)),
                description: `Pedido ${numeroPedido} - SCORN`,
                payment_method_id: 'pix',
                payer: {
                    email: emailCliente || 'cliente@sememail.com',
                    first_name: nomeCliente,
                },
                external_reference: numeroPedido,
                notification_url: `${process.env.SITE_URL}/api/webhook-mercadopago`,
            },
        });

        // Salva o id do pagamento no pedido, para conferir depois no webhook
        await sql`
            UPDATE pedidos SET mp_payment_id = ${String(pagamentoMp.id)} WHERE id = ${pedidoId};
        `;

        const qrCode = pagamentoMp.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = pagamentoMp.point_of_interaction?.transaction_data?.qr_code_base64;

        return response.status(200).json({
            numeroPedido,
            total,
            qrCode,           // string "copia e cola" do PIX
            qrCodeBase64,      // imagem do QR Code em base64 (pode usar em <img src="data:image/png;base64,...">)
            paymentId: pagamentoMp.id,
        });

    } catch (error) {
        console.error('Erro no checkout:', error);
        return response.status(500).json({ error: 'Erro ao gerar cobrança PIX' });
    }
};
