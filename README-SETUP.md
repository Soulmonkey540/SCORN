# SCORN — Guia de Setup (Dashboard Admin + PIX + Baixa de Estoque + WhatsApp)

Este guia assume que o projeto já está conectado a um repositório no Vercel
(deploy automático a cada push) e que você já tem um banco **Vercel Postgres**
criado e vinculado ao projeto.

---

## 1. Rodar o schema no banco

1. No painel do Vercel, entre no projeto → aba **Storage** → seu banco Postgres.
2. Vá em **Query** (ou "Data" → "Query editor", dependendo da versão do painel).
3. Copie todo o conteúdo do arquivo `schema.sql` (na raiz do projeto) e execute.
   - Isso cria as tabelas `produtos` (se não existir), `pedidos`, `pedido_itens`
     e `admins`.
   - É seguro rodar mais de uma vez — usa `IF NOT EXISTS`.

Se você **já tinha** a tabela `produtos` criada com uma estrutura diferente,
me avise qual é a estrutura atual dela antes de rodar, para eu ajustar o
schema em vez de você rodar um `CREATE TABLE` que pode conflitar.

---

## 2. Criar o usuário admin

O login do dashboard usa email + senha, com a senha guardada como **hash**
(nunca em texto puro) na tabela `admins`.

1. No seu computador (não precisa ser no Vercel), com Node instalado, rode
   dentro da pasta do projeto:
   ```bash
   npm install
   node scripts/gerar-hash-senha.js "SuaSenhaForteAqui123"
   ```
2. Isso imprime um hash tipo `$2a$10$abcdef...`. Copie ele.
3. Volte no **Query editor** do Vercel Postgres e rode (trocando os valores):
   ```sql
   INSERT INTO admins (email, senha_hash)
   VALUES ('seuemail@exemplo.com', '$2a$10$COLE_O_HASH_AQUI');
   ```

Pronto — esse email/senha é o que você vai usar para logar em `/admin.html`.
Para adicionar outro admin depois, repita o processo.

---

## 3. Variáveis de ambiente no Vercel

No painel do projeto → **Settings** → **Environment Variables**, adicione:

| Nome | Valor / onde conseguir |
|---|---|
| `POSTGRES_URL` e afins | Já devem existir automaticamente, criadas pelo Vercel ao conectar o banco Postgres. Não precisa mexer. |
| `SESSION_SECRET` | Uma string aleatória longa, só sua. Gere uma com `openssl rand -hex 32` no terminal, ou qualquer gerador de senha forte online. Usada para assinar o login do admin. |
| `MP_ACCESS_TOKEN` | Token de produção (ou teste) do Mercado Pago — veja seção 4. |
| `SITE_URL` | A URL pública do seu site, ex: `https://scorn.vercel.app` (sem barra no final). Usada para o Mercado Pago saber para onde mandar a confirmação de pagamento. |
| `CALLMEBOT_PHONE` | Seu número de WhatsApp com DDI, sem espaços/símbolos. Ex: `5538999999999`. |
| `CALLMEBOT_APIKEY` | Chave gerada pelo CallMeBot — veja seção 5. |

Depois de adicionar, **faça um novo deploy** (ou clique em "Redeploy") para
as variáveis passarem a valer.

---

## 4. Configurar o Mercado Pago (gerador do PIX)

1. Crie uma conta em [mercadopago.com.br](https://www.mercadopago.com.br) se
   ainda não tiver.
2. Acesse o [Painel de Desenvolvedores](https://www.mercadopago.com.br/developers/panel).
3. Crie uma aplicação (qualquer nome, ex: "SCORN Loja").
4. Em **Credenciais de produção**, copie o **Access Token**. Enquanto estiver
   testando, use as **Credenciais de teste** (também tem um Access Token de
   teste) para não gerar cobranças reais.
5. Cole esse token na variável `MP_ACCESS_TOKEN` no Vercel (seção 3).

**Importante sobre o webhook:** o Mercado Pago vai chamar automaticamente
`https://SEUSITE.vercel.app/api/webhook-mercadopago` toda vez que o status
de um pagamento mudar — isso já está configurado no código (usa a variável
`SITE_URL`). Você não precisa cadastrar o webhook manualmente no painel do
Mercado Pago para PIX gerado via API, mas se quiser reforçar/testar,
existe a opção em **Sua aplicação → Webhooks** no painel de desenvolvedores.

Para testar pagamento de verdade sem gastar dinheiro real, use as
[contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/accounts) do Mercado Pago.

---

## 5. Configurar o CallMeBot (aviso via WhatsApp)

O CallMeBot manda a mensagem para **o seu próprio WhatsApp** (o número que
você cadastrar), não para o cliente — serve para você ser avisado de pedidos
pagos.

1. No WhatsApp, adicione o número **+34 644 84 71 87** aos seus contatos.
2. Envie para esse contato a mensagem exata: `I allow callmebot to send me messages`
3. Aguarde a resposta — o bot vai te enviar sua **API Key** (um número).
4. No Vercel, configure:
   - `CALLMEBOT_PHONE` = seu número com DDI (ex: `5538999999999`)
   - `CALLMEBOT_APIKEY` = a chave recebida

**Limitações a saber:** o CallMeBot é um serviço gratuito e não-oficial,
pensado para baixo volume. Se em algum momento as mensagens pararem de
chegar ou ficarem lentas, é sinal de que a loja cresceu o suficiente para
migrar para a **WhatsApp Cloud API** (oficial da Meta) — nesse caso, só
precisamos reescrever o arquivo `lib/whatsapp.js`, nada mais no sistema
muda.

---

## 6. Testando o fluxo completo

1. Acesse `/admin.html`, logue com o email/senha criados na seção 2.
2. Cadastre um produto de teste com estoque (ex: estoque = 5).
3. Acesse a loja normal (`/index.html` ou `/`), adicione esse produto ao
   carrinho, preencha nome/telefone/endereço e clique em "Finalizar via PIX".
4. Vai aparecer um QR Code — se estiver usando credenciais de **teste** do
   Mercado Pago, use um [pagador de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/accounts)
   para simular o pagamento.
5. Após o pagamento ser aprovado:
   - O estoque do produto deve cair automaticamente (confira em `/admin.html`).
   - Você deve receber a mensagem no WhatsApp com número do pedido, itens,
     total e endereço.

Se algum desses passos não acontecer, o primeiro lugar para olhar é
**Vercel → seu projeto → aba Logs**, filtrando pela função
`api/webhook-mercadopago` — todo erro é registrado lá com `console.error`.

---

## Resumo de arquivos novos/alterados

| Arquivo | O que é |
|---|---|
| `schema.sql` | Tabelas novas do banco |
| `scripts/gerar-hash-senha.js` | Utilitário local para criar senha de admin |
| `lib/auth.js` | Sessão de login do admin (cookie + JWT) |
| `lib/whatsapp.js` | Envio de notificação via CallMeBot |
| `lib/pedido.js` | Gera número único de pedido |
| `api/admin/login.js` | Login do admin |
| `api/admin/logout.js` | Logout do admin |
| `api/admin/produtos.js` | CRUD de produtos (protegido) |
| `api/checkout.js` | Cria pedido + gera cobrança PIX |
| `api/webhook-mercadopago.js` | Confirma pagamento, baixa estoque, envia WhatsApp |
| `api/produtos.js` | (já existia) rota pública, sem mudanças de comportamento |
| `admin.html` / `admin.css` / `admin.js` | Dashboard de administração |
| `script.js` | Ajustado: busca produtos reais, formulário de entrega, checkout real |
| `style.css` | Ajustado: estilos do formulário de entrega e QR Code (visual da loja não mudou) |
