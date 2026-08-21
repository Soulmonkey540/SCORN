// api/webhook-mercadopago.js
//
// O Mercado Pago chama esta URL automaticamente sempre que o status de um
// pagamento muda (ex: PIX foi pago). É AQUI, e não no navegador do cliente,
// que confirmamos o pagamento — nunca confie em "o frontend disse que pagou".
//
// Fluxo:
//   1. Recebe notificação -> busca o pagamento real na API do Mercado Pago
//   2. Se status = "approved" -> busca o pedido correspondente no nosso banco
//   3. Se ainda não baixamos o estoque desse pedido (evita duplicar em reenvios):
//        - subtrai o estoque de cada produto comprado
//        - marca o pedido como "pago" e "estoque_baixado = true"
//        - envia a notificação via WhatsApp (CallMeBot)

const { sql } = require('@vercel/postgres');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { enviarNotificacaoWhatsApp } = require('../lib/whatsapp');

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(200).send('ok'); // Mercado Pago só espera 200
    }

    try {
        const paymentId = request.body?.data?.id || request.query?.['data.id'];
        if (!paymentId) {
            return response.status(200).send('sem payment id, ignorado');
        }

        // Busca o pagamento real na API do Mercado Pago (fonte da verdade)
        const payment = new Payment(mpClient);
        const pagamento = await payment.get({ id: paymentId });

        if (pagamento.status !== 'approved') {
            // Ainda não pago (pendente, rejeitado, etc.) — nada a fazer por enquanto
            return response.status(200).send('status não aprovado ainda');
        }

        const numeroPedido = pagamento.external_reference;
        if (!numeroPedido) {
            return response.status(200).send('sem external_reference');
        }

        const resultadoPedido = await sql`
            SELECT * FROM pedidos WHERE numero_pedido = ${numeroPedido};
        `;
        const pedido = resultadoPedido.rows[0];

        if (!pedido) {
            console.error('Webhook: pedido não encontrado para', numeroPedido);
            return response.status(200).send('pedido não encontrado');
        }

        // Evita processar duas vezes o mesmo pedido (Mercado Pago pode reenviar o webhook)
        if (pedido.estoque_baixado) {
            return response.status(200).send('já processado');
        }

        const itensResultado = await sql`
            SELECT * FROM pedido_itens WHERE pedido_id = ${pedido.id};
        `;
        const itens = itensResultado.rows;

        // Subtrai o estoque de cada produto comprado
        for (const item of itens) {
            await sql`
                UPDATE produtos
                SET estoque_total = GREATEST(estoque_total - ${item.quantidade}, 0)
                WHERE id = ${item.produto_id};
            `;
        }

        // Marca o pedido como pago
        await sql`
            UPDATE pedidos
            SET status = 'pago', estoque_baixado = true, pago_em = now()
            WHERE id = ${pedido.id};
        `;

        // Envia a notificação via WhatsApp (não bloqueia o webhook se falhar)
        const resultadoWhats = await enviarNotificacaoWhatsApp({
            numeroPedido: pedido.numero_pedido,
            itens,
            precoTotal: pedido.total,
            enderecoEntrega: pedido.endereco_entrega,
            nomeCliente: pedido.nome_cliente,
        });

        if (!resultadoWhats.enviado) {
            console.error('Falha ao enviar WhatsApp para pedido', numeroPedido, resultadoWhats);
        }

        return response.status(200).send('processado com sucesso');

    } catch (error) {
        console.error('Erro no webhook do Mercado Pago:', error);
        // Retorna 200 mesmo em erro interno para o MP não ficar reenviando em loop
        // infinito enquanto você investiga o log — ajuste se preferir 500.
        return response.status(200).send('erro interno registrado');
    }
};
