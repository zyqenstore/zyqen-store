const CHAVE_CARRINHO_ZYQEN = "zyqenCarrinho";
const CHAVE_SELECIONADO_ZYQEN = "zyqenCarrinhoSelecionado";

const IMAGEM_FALLBACK_CARRINHO =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220" viewBox="0 0 300 220">
  <rect width="300" height="220" fill="#f7f2e9"/>
  <rect x="18" y="18" width="264" height="184" rx="20" fill="#fffaf2" stroke="#e6d8c2" stroke-width="3"/>
  <circle cx="122" cy="92" r="28" fill="#eadcc6"/>
  <path d="M48 170 L120 120 L170 152 L205 126 L252 170 Z" fill="#e1cfb3"/>
  <text x="150" y="195" text-anchor="middle" fill="#9a7a42" font-size="14" font-family="Arial">Imagem</text>
</svg>
`);

document.addEventListener("DOMContentLoaded", () => {
  prepararCarrinhoPage();
  renderizarCarrinho();
});



function prepararCarrinhoPage() {
  const voltar = document.getElementById("carrinho-voltar");
  const limpar = document.getElementById("carrinho-limpar");
  const comprarSelecionado = document.getElementById("carrinho-comprar-selecionado");
  const busca = document.getElementById("carrinho-busca");

  if (voltar) {
    voltar.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "index.html";
      }
    });
  }

  if (limpar) {
    limpar.addEventListener("click", () => {
      const confirmar = confirm("Deseja remover todos os produtos do carrinho?");

      if (!confirmar) return;

      salvarCarrinho([]);
      salvarProdutoSelecionado("");
      renderizarCarrinho();
    });
  }

  if (comprarSelecionado) {
    comprarSelecionado.addEventListener("click", comprarProdutoSelecionado);
  }

  if (busca) {
    busca.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      const termo = busca.value.trim();

      if (termo) {
        window.location.href = `index.html?busca=${encodeURIComponent(termo)}`;
      } else {
        window.location.href = "index.html";
      }
    });
  }

  document.addEventListener("click", event => {
    const remover = event.target.closest?.("[data-remover-carrinho]");
    const aumentar = event.target.closest?.("[data-aumentar-carrinho]");
    const diminuir = event.target.closest?.("[data-diminuir-carrinho]");

    if (remover) {
      const id = remover.dataset.removerCarrinho;
      removerProdutoCarrinho(id);
      return;
    }

    if (aumentar) {
      const id = aumentar.dataset.aumentarCarrinho;
      alterarQuantidadeCarrinho(id, 1);
      return;
    }

    if (diminuir) {
      const id = diminuir.dataset.diminuirCarrinho;
      alterarQuantidadeCarrinho(id, -1);
    }
  });

  document.addEventListener("change", event => {
    const checkbox = event.target.closest?.("[data-selecionar-carrinho]");
    if (!checkbox) return;

    const id = checkbox.dataset.selecionarCarrinho;

    if (checkbox.checked) {
      salvarProdutoSelecionado(id);
    } else {
      salvarProdutoSelecionado("");
    }

    renderizarCarrinho();
  });
}



function renderizarCarrinho() {
  const carrinho = normalizarCarrinho(lerCarrinho());

  const vazio = document.getElementById("carrinho-vazio");
  const conteudo = document.getElementById("carrinho-conteudo");
  const lista = document.getElementById("carrinho-lista");
  const totalItens = document.getElementById("carrinho-total-itens");
  const totalGeral = document.getElementById("carrinho-total-geral");
  const totalSelecionado = document.getElementById("carrinho-total-selecionado");

  const idSelecionadoSalvo = lerProdutoSelecionado();
  const existeSelecionado = carrinho.some(item => String(item.id) === String(idSelecionadoSalvo));
  const idSelecionado = existeSelecionado ? idSelecionadoSalvo : "";

  if (!existeSelecionado) {
    salvarProdutoSelecionado("");
  }

  const quantidadeTotal = carrinho.reduce((soma, item) => {
    return soma + Number(item.quantidade || 1);
  }, 0);

  const valorTotalGeral = carrinho.reduce((soma, item) => {
    const precoNumero = converterPrecoParaNumero(item.preco);
    const quantidade = Number(item.quantidade || 1);

    if (!Number.isFinite(precoNumero)) return soma;

    return soma + precoNumero * quantidade;
  }, 0);

  const itemSelecionado = carrinho.find(item => String(item.id) === String(idSelecionado));

  if (totalItens) {
    totalItens.textContent = quantidadeTotal === 1 ? "1 item" : `${quantidadeTotal} itens`;
  }

  if (totalGeral) {
    totalGeral.textContent = valorTotalGeral > 0 ? formatarMoeda(valorTotalGeral) : "Ver na loja";
  }

  if (totalSelecionado) {
    if (!itemSelecionado) {
      totalSelecionado.textContent = "Selecione um produto";
    } else {
      const precoSelecionado = converterPrecoParaNumero(itemSelecionado.preco);
      const quantidadeSelecionada = Number(itemSelecionado.quantidade || 1);

      totalSelecionado.textContent = Number.isFinite(precoSelecionado)
        ? formatarMoeda(precoSelecionado * quantidadeSelecionada)
        : "Ver preço na loja";
    }
  }

  if (!carrinho.length) {
    if (vazio) vazio.hidden = false;
    if (conteudo) conteudo.hidden = true;
    if (lista) lista.innerHTML = "";
    return;
  }

  if (vazio) vazio.hidden = true;
  if (conteudo) conteudo.hidden = false;

  if (!lista) return;

  lista.innerHTML = carrinho
    .map(item => criarItemCarrinhoHTML(item, idSelecionado))
    .join("");
}

function criarItemCarrinhoHTML(item, idSelecionado) {
  const idOriginal = String(item.id || "");
  const id = escaparHTML(idOriginal);

  const nome = escaparHTML(item.nome || "Produto");
  const precoTexto = escaparHTML(item.preco || "Ver preço");
  const imagem = escaparHTML(item.imagem || IMAGEM_FALLBACK_CARRINHO);
  const categoria = escaparHTML(item.categoria || "Produto");
  const plataforma = escaparHTML(nomePlataformaPublica(item.plataforma || item.categoria || ""));
  const quantidade = Math.max(1, Number(item.quantidade || 1));

  const linkProduto = `produto.html?id=${encodeURIComponent(idOriginal)}`;
  const selecionado = String(idOriginal) === String(idSelecionado);

  const precoNumero = converterPrecoParaNumero(item.preco);
  const subtotal = Number.isFinite(precoNumero)
    ? formatarMoeda(precoNumero * quantidade)
    : "Ver na loja";

  return `
    <article class="carrinho-item ${selecionado ? "selecionado" : ""}">
      <label class="carrinho-check" title="Selecionar este produto">
        <input
          type="checkbox"
          data-selecionar-carrinho="${id}"
          ${selecionado ? "checked" : ""}
        >
        <span></span>
      </label>

      <a class="carrinho-item-img" href="${linkProduto}">
        <img
          src="${imagem}"
          alt="${nome}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK_CARRINHO}'"
        >
      </a>

      <div class="carrinho-item-info">
        <div class="carrinho-item-tags">
          <span>${categoria}</span>
          <small>${plataforma}</small>
        </div>

        <a href="${linkProduto}">
          <h3>${nome}</h3>
        </a>

        <strong>${precoTexto}</strong>

        <div class="carrinho-subtotal">
          <small>Subtotal</small>
          <b>${subtotal}</b>
        </div>

        <div class="carrinho-item-acoes">
          <div class="carrinho-quantidade">
            <button type="button" data-diminuir-carrinho="${id}" aria-label="Diminuir quantidade">−</button>
            <span>${quantidade}</span>
            <button type="button" data-aumentar-carrinho="${id}" aria-label="Aumentar quantidade">+</button>
          </div>

          <button type="button" class="carrinho-remover" data-remover-carrinho="${id}">
            Remover
          </button>
        </div>
      </div>
    </article>
  `;
}



function alterarQuantidadeCarrinho(id, mudanca) {
  const carrinho = normalizarCarrinho(lerCarrinho());
  const item = carrinho.find(produto => String(produto.id) === String(id));

  if (!item) return;

  item.quantidade = Number(item.quantidade || 1) + Number(mudanca || 0);

  if (item.quantidade <= 0) {
    const novoCarrinho = carrinho.filter(produto => String(produto.id) !== String(id));

    if (String(lerProdutoSelecionado()) === String(id)) {
      salvarProdutoSelecionado("");
    }

    salvarCarrinho(novoCarrinho);
  } else {
    salvarCarrinho(carrinho);
  }

  renderizarCarrinho();
}

function removerProdutoCarrinho(id) {
  const carrinho = normalizarCarrinho(lerCarrinho());
  const novoCarrinho = carrinho.filter(item => String(item.id) !== String(id));

  if (String(lerProdutoSelecionado()) === String(id)) {
    salvarProdutoSelecionado("");
  }

  salvarCarrinho(novoCarrinho);
  renderizarCarrinho();
}

function comprarProdutoSelecionado() {
  const carrinho = normalizarCarrinho(lerCarrinho());
  const idSelecionado = lerProdutoSelecionado();

  if (!idSelecionado) {
    alert("Marque um produto para comprar.");
    return;
  }

  const item = carrinho.find(produto => String(produto.id) === String(idSelecionado));

  if (!item) {
    alert("Esse produto não está mais no carrinho.");
    salvarProdutoSelecionado("");
    renderizarCarrinho();
    return;
  }

  if (!item.link || item.link === "#") {
    alert("Esse produto não possui link de compra cadastrado.");
    return;
  }

  window.open(item.link, "_blank", "noopener");
}


function lerCarrinho() {
  try {
    const dados = localStorage.getItem(CHAVE_CARRINHO_ZYQEN);
    const carrinho = JSON.parse(dados);

    return Array.isArray(carrinho) ? carrinho : [];
  } catch (_) {
    return [];
  }
}

function salvarCarrinho(carrinho) {
  localStorage.setItem(CHAVE_CARRINHO_ZYQEN, JSON.stringify(carrinho));
}

function lerProdutoSelecionado() {
  return localStorage.getItem(CHAVE_SELECIONADO_ZYQEN) || "";
}

function salvarProdutoSelecionado(id) {
  localStorage.setItem(CHAVE_SELECIONADO_ZYQEN, String(id || ""));
}

function normalizarCarrinho(carrinho) {
  return Array.isArray(carrinho)
    ? carrinho
        .filter(item => item && (item.id || item.docId))
        .map(item => ({
          id: String(item.id || item.docId || "").trim(),
          nome: String(item.nome || item.titulo || "Produto").trim(),
          preco: String(item.preco || item.precoAtual || "Ver preço").trim(),
          imagem: String(item.imagem || item.img || item.foto || primeiraImagem(item) || "").trim(),
          link: String(item.link || item.url || "#").trim(),
          categoria: String(item.categoria || item.departamento || item.subcategoria || "Produto").trim(),
          plataforma: String(item.plataforma || item.marketplace || item.loja || "").trim(),
          quantidade: Math.max(1, Number(item.quantidade || 1))
        }))
    : [];
}

function primeiraImagem(item) {
  if (Array.isArray(item.imagens) && item.imagens[0]) return item.imagens[0];
  return "";
}


function converterPrecoParaNumero(preco) {
  if (typeof preco === "number") {
    return Number.isFinite(preco) ? preco : NaN;
  }

  const texto = String(preco || "").trim();

  if (!texto) return NaN;

  const match = texto.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)/);

  if (!match) return NaN;

  let valor = match[1];

  if (valor.includes(",")) {
    valor = valor.replace(/\./g, "").replace(",", ".");
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : NaN;
}

function formatarMoeda(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return "Ver na loja";

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}



function nomePlataformaPublica(valor) {
  const slug = slugify(valor);

  if (slug.includes("shopee")) return "Parceiro A";
  if (slug.includes("mercado")) return "Parceiro B";
  if (slug.includes("cakto") || slug.includes("digital")) return "Digital";

  return "Loja parceira";
}

function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}