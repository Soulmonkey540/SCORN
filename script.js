// --- SISTEMA DE TEMA ---
const themeToggleBtn = document.getElementById('theme-toggle');
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}
themeToggleBtn.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
});
initTheme();

// --- SISTEMA MOBILE (MENU E OVERLAY) ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const cartSidebar = document.getElementById('cart-sidebar');

document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
});
document.getElementById('close-sidebar').addEventListener('click', closeOverlays);
overlay.addEventListener('click', closeOverlays);

function closeOverlays() {
    sidebar.classList.remove('open');
    cartSidebar.classList.remove('open');
    overlay.classList.remove('active');
}

// --- NAVEGAÇÃO SPA (Single Page Application) ---
const menuItems = document.querySelectorAll('.menu-item');
const views = document.querySelectorAll('.view-section');

menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Atualiza botões ativos
        menuItems.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        // Troca a View
        const targetView = e.target.getAttribute('data-target');
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetView) view.classList.add('active');
        });

        if (window.innerWidth <= 768) closeOverlays(); // Fecha menu no mobile
    });
});

// --- DADOS (PREPARADO PARA VERCEL) ---
const API_URL_PRODUTOS = '/api/produtos'; 
const API_URL_CHECKOUT = '/api/checkout';

// Adicionei flags 'destaque' e 'novidade' para as outras páginas
const mockDatabase = [
    { id: 1, nome: 'Camiseta Básica SCORN', tipo: 'camiseta', preco: 79.90, tamanhos: ['P', 'M', 'G'], destaque: true, novidade: false, img: 'https://via.placeholder.com/240x260/cccccc/000000?text=Camiseta' },
    { id: 2, nome: 'Camiseta Oversized Logo', tipo: 'camiseta', preco: 119.90, tamanhos: ['M', 'G', 'GG'], destaque: true, novidade: true, img: 'https://via.placeholder.com/240x260/cccccc/000000?text=Oversized' },
    { id: 3, nome: 'Calça Cargo Dark', tipo: 'calca', preco: 259.90, tamanhos: ['M', 'G'], destaque: false, novidade: true, img: 'https://via.placeholder.com/240x260/cccccc/000000?text=Cargo' },
    { id: 4, nome: 'Calça Jeans Reta', tipo: 'calca', preco: 199.90, tamanhos: ['P', 'M', 'G', 'GG'], destaque: true, novidade: false, img: 'https://via.placeholder.com/240x260/cccccc/000000?text=Jeans' },
    { id: 5, nome: 'Jaqueta Puffer SCORN', tipo: 'casaco', preco: 389.90, tamanhos: ['G', 'GG'], destaque: false, novidade: true, img: 'https://via.placeholder.com/240x260/cccccc/000000?text=Puffer' },
    { id: 6, nome: 'Moletom Essential', tipo: 'casaco', preco: 219.90, tamanhos: ['P', 'M', 'G'], destaque: false, novidade: false, img: 'https://via.placeholder.com/240x260/cccccc/000000?text=Moletom' }
];

const state = { produtos: [], carrinho: [] };

async function fetchProdutos() {
    try {
        // No Vercel: const response = await fetch(API_URL_PRODUTOS); const data = await response.json();
        const data = await new Promise(resolve => setTimeout(() => resolve(mockDatabase), 200));
        state.produtos = data;
        
        aplicarFiltros(); // Renderiza catálogo principal
        renderizarSecaoCustomizada(data.filter(p => p.destaque), 'destaques-container');
        renderizarSecaoCustomizada(data.filter(p => p.novidade), 'novidades-container');
    } catch (error) {
        console.error("Erro:", error);
    }
}

// --- RENDERIZAÇÃO ---
function criarCardProduto(produto) {
    const preco = produto.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `
        <div class="product-card">
            <img src="${produto.img}" alt="${produto.nome}" class="product-img">
            <div class="product-info">
                <h4 class="product-name">${produto.nome}</h4>
                <p class="product-price">${preco}</p>
            </div>
            <button class="add-btn" onclick="adicionarAoCarrinho(${produto.id})">Comprar</button>
        </div>
    `;
}

function aplicarFiltros() {
    const tipo = document.getElementById('filter-type').value;
    const tam = document.getElementById('filter-size').value;
    
    const filtrados = state.produtos.filter(p => 
        (tipo === 'all' || p.tipo === tipo) && (tam === 'all' || p.tamanhos.includes(tam))
    );
    renderizarSecaoCustomizada(filtrados, 'catalog-container');
}

function renderizarSecaoCustomizada(produtos, containerId) {
    const container = document.getElementById(containerId);
    if (produtos.length === 0) {
        container.innerHTML = '<p>Nenhum produto encontrado.</p>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'product-grid';
    grid.innerHTML = produtos.map(p => criarCardProduto(p)).join('');
    
    container.innerHTML = '';
    container.appendChild(grid);
}

// --- CARRINHO E CHECKOUT ---
document.getElementById('cart-btn').addEventListener('click', () => {
    cartSidebar.classList.add('open');
    overlay.classList.add('active');
    renderizarCarrinho();
});
document.getElementById('close-cart').addEventListener('click', closeOverlays);

function adicionarAoCarrinho(id) {
    const prod = state.produtos.find(p => p.id === id);
    if (prod) {
        // Para simplificar, gera um ID único para cada item no carrinho (permite mesma roupa 2x)
        state.carrinho.push({ ...prod, cartId: Date.now() }); 
        document.getElementById('cart-count').textContent = state.carrinho.length;
        
        const btn = document.getElementById('cart-btn');
        btn.style.transform = 'scale(1.1)';
        setTimeout(() => btn.style.transform = 'scale(1)', 200);
    }
}

function removerDoCarrinho(cartId) {
    state.carrinho = state.carrinho.filter(item => item.cartId !== cartId);
    document.getElementById('cart-count').textContent = state.carrinho.length;
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');
    
    if (state.carrinho.length === 0) {
        container.innerHTML = '<p>Seu carrinho está vazio.</p>';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    let total = 0;
    container.innerHTML = state.carrinho.map(item => {
        total += item.preco;
        const preco = item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.nome}</h4>
                    <p>${preco}</p>
                </div>
                <button class="remove-btn" onclick="removerDoCarrinho(${item.cartId})">Remover</button>
            </div>
        `;
    }).join('');

    totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// INTEGRAÇÃO COM VERCEL (ENVIAR PEDIDO E GERAR PIX)
document.getElementById('checkout-btn').addEventListener('click', async () => {
    if (state.carrinho.length === 0) return alert("Adicione itens ao carrinho!");

    const btn = document.getElementById('checkout-btn');
    btn.textContent = "Gerando PIX...";
    btn.disabled = true;

    try {
        // O corpo da requisição que vai para a Serverless Function do Vercel
        const payload = {
            itens: state.carrinho.map(item => item.id),
            total: state.carrinho.reduce((acc, item) => acc + item.preco, 0)
        };

        // Simulação do POST para o Vercel:
        // const response = await fetch(API_URL_CHECKOUT, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload)
        // });
        // const dadosPagamento = await response.json();
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simula delay da rede

        alert("Pedido registrado no Vercel (Status: Aguardando PIX).\nO QR Code seria exibido aqui.");
        
        // Limpa carrinho após sucesso
        state.carrinho = [];
        document.getElementById('cart-count').textContent = '0';
        closeOverlays();

    } catch (error) {
        alert("Erro ao processar pedido.");
    } finally {
        btn.textContent = "Finalizar via PIX";
        btn.disabled = false;
    }
});

// Init
document.getElementById('filter-type').addEventListener('change', aplicarFiltros);
document.getElementById('filter-size').addEventListener('change', aplicarFiltros);
document.addEventListener('DOMContentLoaded', fetchProdutos);