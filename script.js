import { db } from "./firebase.js";

import {
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  arrayUnion,
  increment
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


let listaProdutos = [];
let listaFaixasParceiros = [];
let produtoAtualPopup = null;
let historicoProdutosPopup = [];
let midiasProdutoAtual = [];
let indiceMidiaAtual = 0;
let comentarioEnviando = false;

let plataformaAtual = "Todos";
let departamentoAtual = "Todos";
let subcategoriaAtual = "Todos";
let filtroRapidoAtual = "todos";
let ordenarAtual = "relevancia";
let paginaAtual = 1;

let timerDispositivo = null;
let cliquesEmAndamento = new Set();

let chatProdutoInicializado = false;
let chatArrastando = false;
let chatOffsetX = 0;
let chatOffsetY = 0;

const PRODUTOS_POR_PAGINA = 12;
const TELEFONE_WHATSAPP = "5575981768068";

const IMAGEM_FALLBACK =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="520" viewBox="0 0 700 520">
  <rect width="700" height="520" fill="#f7f2e9"/>
  <rect x="35" y="35" width="630" height="450" rx="34" fill="#fffaf2" stroke="#e6d8c2" stroke-width="4"/>
  <circle cx="270" cy="218" r="58" fill="#eadcc6"/>
  <path d="M112 405 L280 280 L395 360 L485 300 L600 405 Z" fill="#e1cfb3"/>
  <text x="350" y="456" text-anchor="middle" fill="#9a7a42" font-size="25" font-family="Arial">Imagem não encontrada</text>
</svg>
`);

const ESTRELA_SVG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c7963e" stroke="#a87728" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>
`);

const ICONES_PADRAO = {
  loja: "imagens/icones/store.svg",
  sacola: "imagens/icones/shopping-bag.svg",
  caixa: "imagens/icones/package.svg",
  digital: "imagens/icones/download.svg",
  eletronicos: "imagens/icones/bot.svg",
  casa: "imagens/icones/store.svg",
  moda: "imagens/icones/tag.svg",
  celular: "imagens/icones/smartphone.svg",
  estrela: "imagens/icones/star.svg",
  play: "imagens/icones/play.svg",
  escudo: "imagens/icones/shield-check.svg",
  cadeado: "imagens/icones/lock.svg"
};

const NOMES_PUBLICOS_PLATAFORMA = {
  shopee: "Parceiro A",
  "mercado-livre": "Parceiro B",
  mercadolivre: "Parceiro B",
  cakto: "Digital",
  digital: "Digital"
};

const FAIXAS_PARCEIROS_PADRAO = [
  {
    docId: "mercado-livre",
    nome: "Mercado Livre",
    slug: "mercado-livre",
    cor: "#ffe600",
    opacidade: 0.22,
    ordem: 1,
    ativo: true
  },
  {
    docId: "shopee",
    nome: "Shopee",
    slug: "shopee",
    cor: "#ee4d2d",
    opacidade: 0.18,
    ordem: 2,
    ativo: true
  }
];


document.addEventListener("DOMContentLoaded", () => {
  detectarDispositivo();
  bloquearZoomMobile();
  ajustarBaseDoSite();
  garantirEstruturaEssencial();
  injetarEstilosMinimosDoScript();

  prepararBusca();
  aplicarBuscaDaURL();
  prepararOrdenacao();
  prepararCliquesGerais();
  prepararFormularioComentario();
  prepararChatProduto();
  ativarSwipeImagem();
  registrarPWA();

  carregarFaixasParceirosFirebase();
  carregarProdutosFirebase();

  window.addEventListener("resize", () => {
    agendarDeteccaoDispositivo();
    manterChatDentroDaTela();
    aplicarCorrecaoGaleriaProduto();
  });

  window.addEventListener("orientationchange", () => {
    agendarDeteccaoDispositivo();

    setTimeout(() => {
      manterChatDentroDaTela();
      aplicarCorrecaoGaleriaProduto();
    }, 250);
  });
});


function detectarDispositivo() {
  const html = document.documentElement;
  const body = document.body;

  if (!body) return;

  const largura = window.innerWidth || html.clientWidth || 0;
  const ehTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );

  const classes = ["modo-mobile", "modo-tablet", "modo-desktop", "tem-touch", "sem-touch"];

  html.classList.remove(...classes);
  body.classList.remove(...classes);

  let dispositivo = "desktop";

  if (largura <= 768 || mobileUA) {
    dispositivo = "mobile";
  } else if (largura <= 1180) {
    dispositivo = "tablet";
  }

  html.classList.add(`modo-${dispositivo}`, ehTouch ? "tem-touch" : "sem-touch");
  body.classList.add(`modo-${dispositivo}`, ehTouch ? "tem-touch" : "sem-touch");

  html.dataset.dispositivo = dispositivo;
  body.dataset.dispositivo = dispositivo;
}

function agendarDeteccaoDispositivo() {
  clearTimeout(timerDispositivo);
  timerDispositivo = setTimeout(detectarDispositivo, 120);
}

function bloquearZoomMobile() {
  const html = document.documentElement;
  const body = document.body;

  html.style.width = "100%";
  html.style.maxWidth = "100%";
  html.style.overflowX = "hidden";
  html.style.touchAction = "manipulation";

  body.style.width = "100%";
  body.style.maxWidth = "100%";
  body.style.overflowX = "hidden";
  body.style.touchAction = "manipulation";

  const impedirGesture = event => {
    event.preventDefault();
  };

  document.addEventListener("gesturestart", impedirGesture, { passive: false });
  document.addEventListener("gesturechange", impedirGesture, { passive: false });
  document.addEventListener("gestureend", impedirGesture, { passive: false });

  document.addEventListener(
    "touchmove",
    event => {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  let ultimoToque = 0;

  document.addEventListener(
    "touchend",
    event => {
      const agora = Date.now();

      if (agora - ultimoToque <= 320) {
        event.preventDefault();
      }

      ultimoToque = agora;
    },
    { passive: false }
  );

  document.addEventListener(
    "wheel",
    event => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "keydown",
    event => {
      const tecla = String(event.key || "").toLowerCase();
      const estaTentandoZoom =
        (event.ctrlKey || event.metaKey) &&
        (tecla === "+" ||
          tecla === "-" ||
          tecla === "=" ||
          tecla === "0" ||
          tecla === "add" ||
          tecla === "subtract");

      if (estaTentandoZoom) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "dblclick",
    event => {
      event.preventDefault();
    },
    { passive: false }
  );
}

function ajustarBaseDoSite() {
  const aplicar = () => {
    document.documentElement.style.width = "100%";
    document.documentElement.style.maxWidth = "100%";
    document.documentElement.style.overflowX = "hidden";

    document.body.style.width = "100%";
    document.body.style.maxWidth = "100%";
    document.body.style.overflowX = "hidden";
  };

  aplicar();
  window.addEventListener("resize", aplicar);
}


function carregarProdutosFirebase() {
  const produtosRef = collection(db, "produtos");
  const q = query(produtosRef);

  onSnapshot(
    q,
    snapshot => {
      listaProdutos = snapshot.docs
        .map(d => normalizarProduto({ docId: d.id, ...d.data() }))
        .filter(produtoEstaAtivo)
        .sort((a, b) => {
          const oa = Number(a.ordem) || 999;
          const ob = Number(b.ordem) || 999;

          if (oa !== ob) return oa - ob;
          if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;

          return dataProduto(b) - dataProduto(a);
        });

      paginaAtual = 1;
      aplicarFiltros();

      if (produtoAtualPopup) {
        const atualizado = listaProdutos.find(
          p =>
            String(p.id) === String(produtoAtualPopup.id) ||
            String(p.docId) === String(produtoAtualPopup.docId)
        );

        if (atualizado) {
          produtoAtualPopup = atualizado;
          midiasProdutoAtual = montarMidiasProduto(atualizado);
          preencherPopup(atualizado, false);
        } else {
          fecharPopup();
        }
      }
    },
    erro => {
      console.warn("Erro ao carregar produtos.", erro);
      mostrarErroProdutos("Não foi possível carregar os produtos agora. Verifique o Firebase e tente novamente.");
    }
  );
}

function carregarFaixasParceirosFirebase() {
  const faixasRef = collection(db, "faixasParceiros");
  const q = query(faixasRef);

  onSnapshot(
    q,
    snapshot => {
      listaFaixasParceiros = snapshot.docs
        .map(d => normalizarFaixaParceiro({ docId: d.id, ...d.data() }))
        .filter(faixa => faixa.ativo !== false)
        .sort((a, b) => (Number(a.ordem) || 999) - (Number(b.ordem) || 999));

      if (produtoAtualPopup) {
        renderizarFaixaParceiroPopup(produtoAtualPopup);
      }
    },
    erro => {
      console.warn("Erro ao carregar barrinhas dos parceiros.", erro);
      listaFaixasParceiros = [];
    }
  );
}

function produtoEstaAtivo(produto) {
  return produto.ativo !== false;
}


function normalizarFaixaParceiro(f) {
  const nome = String(f.nome || f.titulo || "Barrinha").trim();
  const slug = String(f.slug || f.id || f.docId || slugify(nome)).trim();
  const opacidadeNumero = Number(f.opacidade);

  return {
    ...f,
    docId: f.docId || slug,
    nome,
    slug,
    cor: String(f.cor || f.color || "#b98a37").trim(),
    opacidade: Number.isFinite(opacidadeNumero)
      ? Math.max(0.05, Math.min(1, opacidadeNumero))
      : 0.18,
    ordem: Number(f.ordem) || 999,
    ativo: f.ativo !== false
  };
}

function normalizarProduto(p) {
  const categoriaBase = String(
    p.categoria || p.categoriaNome || p.marketplace || p.loja || p.plataforma || "Geral"
  ).trim();

  const categoriaSlug = String(
    p.categoriaSlug || p.marketplaceSlug || p.lojaSlug || p.plataformaSlug || slugify(categoriaBase)
  ).trim();

  const plataformaNome = String(
    p.plataforma || p.plataformaNome || p.marketplace || p.loja || categoriaBase || "Geral"
  ).trim();

  const plataformaSlug = String(
    p.plataformaSlug || p.marketplaceSlug || p.lojaSlug || categoriaSlug || slugify(plataformaNome)
  ).trim();

  const departamentoNome = String(
    p.departamento || p.departamentoNome || p.nicho || p.grupo || p.categoriaPrincipal || "Geral"
  ).trim();

  const departamentoSlug = String(
    p.departamentoSlug || p.nichoSlug || p.grupoSlug || slugify(departamentoNome)
  ).trim();

  const subcategoriaNome = String(
    p.subcategoria || p.subCategoria || p.subcategoriaNome || p.subCategoriaNome || p.categoriaFilha || "Geral"
  ).trim();

  const subcategoriaSlug = String(
    p.subcategoriaSlug || p.subCategoriaSlug || slugify(subcategoriaNome)
  ).trim();

  return {
    ...p,

    id: p.id || p.docId,
    docId: p.docId,
    ativo: p.ativo !== false,

    nome: String(p.nome || p.titulo || "Produto sem nome").trim(),
    descricao: String(p.descricao || "").trim(),

    categoria: categoriaBase,
    categoriaSlug,

    plataforma: plataformaNome,
    plataformaSlug,

    departamento: departamentoNome,
    departamentoSlug,

    subcategoria: subcategoriaNome,
    subcategoriaSlug,

    imagens: Array.isArray(p.imagens) ? p.imagens.filter(Boolean) : [],
    videos: Array.isArray(p.videos) ? p.videos.filter(Boolean) : [],

    detalhes: Array.isArray(p.detalhes) ? p.detalhes.filter(Boolean) : [],
    observacoes: Array.isArray(p.observacoes) ? p.observacoes.filter(Boolean) : [],
    comentarios: Array.isArray(p.comentarios) ? p.comentarios : [],

    avaliacao: Number(p.avaliacao) || 0,
    avaliacoes: Number(p.avaliacoes) || 0,
    vendidos: Number(p.vendidos) || 0,
    ordem: Number(p.ordem) || 999,

    preco: String(p.preco || p.precoAtual || "").trim(),
    precoAntigo: String(p.precoAntigo || "").trim(),

    parcelamento: String(p.parcelamento || "").trim(),
    textoParcelamento: String(p.textoParcelamento || "").trim(),
    textoDestaque: String(p.textoDestaque || p.destaqueParcelamento || "").trim(),
    faixaParceiroId: String(p.faixaParceiroId || p.faixaId || p.barrinhaParceiroId || "").trim(),

    link: String(p.link || "").trim(),
    botao: String(p.botao || "Comprar agora").trim(),
    mensagemWhatsapp: String(p.mensagemWhatsapp || "").trim(),

    selo: String(p.selo || "").trim(),
    urgencia: String(p.urgencia || "").trim(),

    destaque: Boolean(p.destaque || p.tipoDestaque),
    tipoDestaque: String(p.tipoDestaque || "").trim(),
    tipo: String(p.tipo || "produto").trim(),

    criadoEm: p.criadoEm || p.createdAt || p.dataCriacao || null,
    atualizadoEm: p.atualizadoEm || p.updatedAt || null
  };
}


function garantirEstruturaEssencial() {
  let main = document.querySelector("main");

  if (!main) {
    main = document.createElement("main");
    main.id = "produtos";
    document.body.appendChild(main);
  }

  if (!document.getElementById("categorias-container") && !document.getElementById("produtos-grid")) {
    const container = document.createElement("section");
    container.id = "categorias-container";
    container.className = "categorias-container";
    container.setAttribute("data-produtos-grid", "");
    main.appendChild(container);
  }

  if (!document.getElementById("popup-produto")) {
    document.body.insertAdjacentHTML("beforeend", criarHTMLPopupProduto());
  }

  if (!document.getElementById("popup-sucesso-comentario")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="popup-sucesso-comentario" class="popup-sucesso-comentario">
        <div class="popup-sucesso-card">
          <strong>Comentário enviado!</strong>
          <p>Obrigado por ajudar outros visitantes da Zyqen Store.</p>
          <button type="button" onclick="fecharPopupSucessoComentario()">Fechar</button>
        </div>
      </div>
      `
    );
  }

  if (!document.getElementById("chat-produto-widget")) {
    document.body.insertAdjacentHTML("beforeend", criarHTMLChatProduto());
  }
}

function criarHTMLPopupProduto() {
  return `
    <div id="popup-produto" class="popup-produto" aria-hidden="true">
      <div class="popup-produto-backdrop" data-fechar-popup></div>

      <article class="popup-produto-card">
        <button type="button" class="popup-fechar" data-fechar-popup aria-label="Fechar produto">×</button>

        <div class="popup-galeria">
          <div class="popup-imagem-area" data-aspecto="quadrada">
            <button type="button" class="popup-seta popup-seta-esq" onclick="imagemAnteriorPopup()" aria-label="Imagem anterior">‹</button>

            <img id="popup-imagem" src="${IMAGEM_FALLBACK}" alt="Produto">

            <span id="popup-contador-imagem" class="popup-contador-imagem">1/1</span>

            <button type="button" class="popup-seta popup-seta-dir" onclick="proximaImagemPopup()" aria-label="Próxima imagem">›</button>
          </div>

          <div id="popup-thumbs" class="popup-thumbs"></div>

          <div id="popup-recomendados" class="zq-popup-recomendados"></div>
        </div>

        <div class="popup-conteudo">
          <div class="popup-topline">
            <span id="popup-categoria" class="popup-categoria">Produto</span>

            <button type="button" class="popup-share" onclick="compartilharProduto()" aria-label="Compartilhar">
              Compartilhar
            </button>
          </div>

          <h2 id="popup-nome">Produto</h2>

          <div class="popup-rating">
            <span id="popup-avaliacao-media">Novo</span>
            <span id="popup-estrelas"></span>
            <span id="popup-avaliacao-total">Sem avaliações ainda</span>
          </div>

          <div class="popup-precos">
            <span id="popup-preco-antigo" class="popup-preco-antigo"></span>
            <strong id="popup-preco">Ver preço</strong>
            <span id="popup-parcelamento" class="popup-parcelamento"></span>
            <span id="popup-faixa-parceiro" class="popup-faixa-parceiro"></span>
            <small id="popup-destaque-parcelamento" class="popup-destaque-parcelamento"></small>
          </div>

          <p id="popup-descricao" class="popup-descricao"></p>

          <div id="popup-confianca-bloco" class="popup-confianca-bloco"></div>
          <div id="popup-detalhes" class="popup-detalhes"></div>
          <div id="popup-observacoes" class="popup-observacoes"></div>

          <div class="barra-compra">
            <a id="popup-comprar-link" class="btn-comprar-popup" href="#" target="_blank" rel="noopener">
              Comprar agora
            </a>

            <button type="button" class="btn-chat-popup" onclick="abrirChatProduto()">
              Dúvida?
            </button>
          </div>
        </div>
      </article>
    </div>
  `;
}

function criarHTMLChatProduto() {
  return `
    <div id="chat-produto-widget" class="chat-produto-widget" hidden aria-hidden="true">
      <div id="chat-produto-card" class="chat-produto-card">
        <div id="chat-produto-topo" class="chat-produto-topo">
          <div class="chat-produto-info">
            <img id="chat-produto-img" src="${IMAGEM_FALLBACK}" alt="">
            <div>
              <strong id="chat-produto-nome">Produto selecionado</strong>
              <span id="chat-produto-preco">Tire suas dúvidas</span>
            </div>
          </div>

          <div class="chat-produto-acoes">
            <button type="button" onclick="minimizarChatProduto()">−</button>
            <button type="button" onclick="fecharChatProduto()">×</button>
          </div>
        </div>

        <div id="chat-produto-mensagens" class="chat-produto-mensagens">
          <div class="chat-msg chat-msg-bot">
            <p>Olá! Posso te ajudar com preço, parcelamento, segurança ou características desse produto.</p>
          </div>
        </div>

        <div id="chat-produto-sugestoes" class="chat-produto-sugestoes"></div>

        <form id="chat-produto-form" class="chat-produto-form">
          <input id="chat-produto-input" placeholder="Digite sua dúvida...">
          <button type="submit">Enviar</button>
        </form>

        <button id="chat-produto-whatsapp" type="button" class="chat-produto-whatsapp">
          Chamar no WhatsApp
        </button>
      </div>
    </div>
  `;
}


function prepararBusca() {
  const campos = [
    document.getElementById("pesquisa"),
    document.getElementById("buscaProdutos"),
    document.getElementById("searchProdutos"),
    document.querySelector("[data-busca-produtos]"),
    document.querySelector(".zq-search-input")
  ].filter(Boolean);

  campos.forEach(campo => {
    campo.addEventListener("input", () => {
      paginaAtual = 1;
      aplicarFiltros();
    });
  });
}

function prepararOrdenacao() {
  const selects = [
    document.getElementById("ordenar-produtos"),
    document.getElementById("ordenarProdutos"),
    document.querySelector("[data-ordenar-produtos]"),
    document.querySelector(".zq-order-select")
  ].filter(Boolean);

  selects.forEach(select => {
    select.addEventListener("change", () => {
      ordenarAtual = normalizarOrdenacao(select.value || select.options?.[select.selectedIndex]?.text || "");
      paginaAtual = 1;
      aplicarFiltros();
    });
  });
}

function prepararCliquesGerais() {
  document.addEventListener("click", event => {
    const fechar = event.target.closest("[data-fechar-popup]");

    if (fechar) {
      fecharPopup();
      return;
    }

    const voltarProduto = event.target.closest("[data-voltar-produto]");

    if (voltarProduto) {
      voltarProdutoAnterior();
      return;
    }

    const recomendado = event.target.closest("[data-popup-recomendado]");

    if (recomendado) {
      abrirProdutoRecomendado(recomendado.dataset.popupRecomendado || recomendado.dataset.openProduct);
      return;
    }

    const open = event.target.closest("[data-open-product]");

    if (open) {
      abrirPaginaProduto(open.dataset.openProduct);
      return;
    }

    const plataforma = event.target.closest("[data-filtrar-plataforma]");

    if (plataforma) {
      filtrarPlataforma(plataforma.dataset.filtrarPlataforma || "Todos");
      return;
    }

    const departamento = event.target.closest("[data-filtrar-departamento]");

    if (departamento) {
      filtrarDepartamento(departamento.dataset.filtrarDepartamento || "Todos");
      return;
    }

    const subcategoria = event.target.closest("[data-filtrar-subcategoria]");

    if (subcategoria) {
      filtrarSubcategoria(subcategoria.dataset.filtrarSubcategoria || "Todos");
      return;
    }

    const filtroRapido = event.target.closest("[data-filtro-rapido]");

    if (filtroRapido) {
      filtrarRapido(filtroRapido.dataset.filtroRapido || "todos");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      fecharPopup();
      fecharChatProduto();
    }

    if (event.key === "Enter") {
      const card = event.target.closest?.(".produto-card[data-open-product]");
      if (card) abrirPaginaProduto(card.dataset.openProduct);
    }
  });
}


function aplicarBuscaDaURL() {
  const params = new URLSearchParams(window.location.search);
  const buscaURL = params.get("busca") || params.get("pesquisa") || "";

  if (!buscaURL) return;

  const campo =
    document.getElementById("pesquisa") ||
    document.getElementById("buscaProdutos") ||
    document.getElementById("searchProdutos") ||
    document.querySelector("[data-busca-produtos]") ||
    document.querySelector(".zq-search-input");

  if (campo) campo.value = buscaURL;
}

function abrirPaginaProduto(id) {
  const produtoId = String(id || "").trim();

  if (!produtoId) return;

  window.location.href = `produto.html?id=${encodeURIComponent(produtoId)}`;
}

function aplicarFiltros() {
  const termo = normalizarTexto(pegarTextoBusca());

  let produtos = listaProdutos.filter(produto => {
    if (!produtoCombinaPlataforma(produto, plataformaAtual)) return false;
    if (!produtoCombinaDepartamento(produto, departamentoAtual)) return false;
    if (!produtoCombinaSubcategoria(produto, subcategoriaAtual)) return false;
    if (!produtoCombinaFiltroRapido(produto)) return false;
    if (!produtoCombinaPesquisa(produto, termo)) return false;

    return true;
  });

  produtos = aplicarOrdenacaoProdutos(produtos);

  renderizarProdutos(produtos);
  atualizarStatusBusca(produtos.length);
}

function pegarTextoBusca() {
  const campo =
    document.getElementById("pesquisa") ||
    document.getElementById("buscaProdutos") ||
    document.getElementById("searchProdutos") ||
    document.querySelector("[data-busca-produtos]") ||
    document.querySelector(".zq-search-input");

  return campo?.value || "";
}

function atualizarStatusBusca(total) {
  const contador =
    document.getElementById("contador-produtos") ||
    document.getElementById("contadorProdutos") ||
    document.querySelector("[data-contador-produtos]");

  if (contador) {
    contador.textContent = total === 1 ? "1 produto encontrado" : `${total} produtos encontrados`;
  }
}

function renderizarProdutos(produtos) {
  const alvo =
    document.getElementById("produtos-grid") ||
    document.getElementById("listaProdutos") ||
    document.getElementById("categorias-container") ||
    document.querySelector("[data-produtos-grid]");

  if (!alvo) return;

  if (!produtos.length) {
    alvo.innerHTML = `
      <section class="zq-empty-products">
        <span>Busca sem resultado</span>
        <h2>Nenhum produto encontrado</h2>
        <p>Tente limpar os filtros ou pesquisar outro nome.</p>
        <button type="button" onclick="limparFiltrosHierarquia()">Limpar filtros</button>
      </section>
    `;

    return;
  }

  const totalPaginas = Math.max(1, Math.ceil(produtos.length / PRODUTOS_POR_PAGINA));

  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
  const produtosPagina = produtos.slice(inicio, inicio + PRODUTOS_POR_PAGINA);

  alvo.innerHTML = `
    <section class="zq-products-section">
      <div class="zq-products-head">
        <div>
          <span>Produtos selecionados</span>
          <h2>${escaparHTML(tituloSecaoAtual())}</h2>
        </div>

        <button type="button" onclick="limparFiltrosHierarquia()">Ver todos</button>
      </div>

      <div class="produtos-grid">
        ${produtosPagina.map(criarCardProduto).join("")}
      </div>

      ${gerarHTMLPaginacao(totalPaginas, paginaAtual)}
    </section>
  `;
}

function tituloSecaoAtual() {
  if (subcategoriaAtual !== "Todos") {
    return nomeCategoriaPorSlug(subcategoriaAtual, "subcategoria");
  }

  if (departamentoAtual !== "Todos") {
    return nomeCategoriaPorSlug(departamentoAtual, "departamento");
  }

  if (plataformaAtual !== "Todos") {
    return nomePublicoPlataforma(plataformaAtual);
  }

  return "Produtos em Destaque";
}

function criarCardProduto(produto) {
  const id = String(produto.id || produto.docId);
  const imagem = imagemPrincipal(produto);
  const avaliacao = Number(produto.avaliacao) || 0;
  const vendidos = Number(produto.vendidos) || 0;
  const selo = produto.selo || produto.tipoDestaque || (produto.destaque ? "Destaque" : "");

  return `
    <article
      class="produto-card zq-product-card ${produto.destaque ? "produto-destaque" : ""}"
      data-open-product="${escaparHTML(id)}"
      role="button"
      tabindex="0"
      aria-label="Abrir ${escaparHTML(produto.nome)}"
    >
      <div class="produto-img-wrap">
        ${selo ? `<span class="produto-selo">${escaparHTML(selo)}</span>` : ""}

        <button
          type="button"
          class="produto-fav"
          aria-label="Favoritar"
          onclick="event.stopPropagation();"
        >
          ♡
        </button>

        <img
          src="${escaparHTML(imagem)}"
          alt="${escaparHTML(produto.nome)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"
        >
      </div>

      <div class="produto-info">
        <span class="produto-categoria">
          ${escaparHTML(categoriaPublicaDoProduto(produto))}
        </span>

        <h3>${escaparHTML(produto.nome)}</h3>

        <div class="produto-rating">
          <span class="estrelas-mini">${gerarEstrelas(avaliacao || 5)}</span>
          <small>
            ${avaliacao ? avaliacao.toFixed(1).replace(".", ",") : "Novo"}
            ${vendidos ? `· ${vendidos}+ vendidos` : ""}
          </small>
        </div>

        <div class="produto-precos">
          ${produto.precoAntigo ? `<span class="preco-antigo">${escaparHTML(produto.precoAntigo)}</span>` : ""}
          <strong>${escaparHTML(produto.preco || "Ver preço")}</strong>
          ${
            produto.parcelamento
              ? `<span class="produto-parcelamento">${escaparHTML(produto.parcelamento)} ${
                  produto.textoParcelamento ? `<b>${escaparHTML(produto.textoParcelamento)}</b>` : ""
                }</span>`
              : ""
          }
        </div>

        ${produto.textoDestaque ? `<p class="produto-destaque-texto">${escaparHTML(produto.textoDestaque)}</p>` : ""}

        <button type="button" class="produto-ver-btn" data-open-product="${escaparHTML(id)}">
          Ver produto
        </button>
      </div>
    </article>
  `;
}

function gerarHTMLPaginacao(total, atual) {
  if (total <= 1) return "";

  const anterior = Math.max(1, atual - 1);
  const proxima = Math.min(total, atual + 1);

  return `
    <div class="paginacao">
      <button type="button" ${atual === 1 ? "disabled" : ""} onclick="trocarPaginaProdutos(${anterior})">‹</button>

      ${gerarListaPaginas(total, atual)
        .map(p => {
          if (p === "...") return `<span class="paginacao-reticencias">...</span>`;

          return `
            <button type="button" class="${p === atual ? "ativo" : ""}" onclick="trocarPaginaProdutos(${p})">
              ${p}
            </button>
          `;
        })
        .join("")}

      <button type="button" ${atual === total ? "disabled" : ""} onclick="trocarPaginaProdutos(${proxima})">›</button>
    </div>
  `;
}

function gerarListaPaginas(total, atual) {
  const paginas = [];
  const inicio = Math.max(1, atual - 2);
  const fim = Math.min(total, atual + 2);

  if (inicio > 1) paginas.push(1);
  if (inicio > 2) paginas.push("...");

  for (let i = inicio; i <= fim; i++) paginas.push(i);

  if (fim < total - 1) paginas.push("...");
  if (fim < total) paginas.push(total);

  return paginas;
}

function trocarPaginaProdutos(pagina) {
  paginaAtual = Number(pagina) || 1;
  aplicarFiltros();

  const secao = document.querySelector(".zq-products-section") || document.getElementById("categorias-container");

  if (secao) {
    secao.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}


function filtrarRapido(tipo) {
  filtroRapidoAtual = tipo || "todos";
  paginaAtual = 1;
  aplicarFiltros();
}

function limparFiltrosHierarquia() {
  plataformaAtual = "Todos";
  departamentoAtual = "Todos";
  subcategoriaAtual = "Todos";
  filtroRapidoAtual = "todos";
  paginaAtual = 1;

  const campo =
    document.getElementById("pesquisa") ||
    document.getElementById("buscaProdutos") ||
    document.getElementById("searchProdutos") ||
    document.querySelector("[data-busca-produtos]") ||
    document.querySelector(".zq-search-input");

  if (campo) campo.value = "";

  aplicarFiltros();
}

function filtrarCategoria(slug) {
  filtrarPlataforma(slug);
}

function filtrarPlataforma(slug) {
  plataformaAtual = slug || "Todos";
  departamentoAtual = "Todos";
  subcategoriaAtual = "Todos";
  paginaAtual = 1;
  aplicarFiltros();
}

function filtrarDepartamento(slug) {
  departamentoAtual = slug || "Todos";
  subcategoriaAtual = "Todos";
  paginaAtual = 1;
  aplicarFiltros();
}

function filtrarSubcategoria(slug) {
  subcategoriaAtual = slug || "Todos";
  paginaAtual = 1;
  aplicarFiltros();
}

function produtoCombinaPesquisa(produto, termo) {
  if (!termo) return true;
  return textoBuscaProduto(produto).includes(termo);
}

function produtoCombinaFiltroRapido(produto) {
  switch (filtroRapidoAtual) {
    case "destaques":
      return Boolean(produto.destaque || produto.tipoDestaque || produto.textoDestaque);

    case "ofertas":
      return Boolean(produto.precoAntigo || produto.selo || produto.urgencia || produto.tipoDestaque);

    case "bem-avaliados":
      return Number(produto.avaliacao) >= 4.5;

    case "mais-vendidos":
      return Number(produto.vendidos) >= 50;

    default:
      return true;
  }
}

function produtoCombinaPlataforma(produto, slug) {
  if (!slug || slug === "Todos") return true;

  const campos = [
    produto.plataformaSlug,
    produto.categoriaSlug,
    slugify(produto.plataforma),
    slugify(produto.categoria)
  ];

  return campos.includes(slug);
}

function produtoCombinaDepartamento(produto, slug) {
  if (!slug || slug === "Todos") return true;

  const campos = [produto.departamentoSlug, slugify(produto.departamento)];
  return campos.includes(slug);
}

function produtoCombinaSubcategoria(produto, slug) {
  if (!slug || slug === "Todos") return true;

  const campos = [produto.subcategoriaSlug, slugify(produto.subcategoria)];
  return campos.includes(slug);
}

function aplicarOrdenacaoProdutos(produtos) {
  const lista = [...produtos];

  switch (ordenarAtual) {
    case "menor-preco":
      return lista.sort((a, b) => numeroPreco(a.preco) - numeroPreco(b.preco));

    case "maior-preco":
      return lista.sort((a, b) => numeroPreco(b.preco) - numeroPreco(a.preco));

    case "melhor-avaliados":
      return lista.sort((a, b) => Number(b.avaliacao) - Number(a.avaliacao));

    case "novidades":
      return lista.sort((a, b) => dataProduto(b) - dataProduto(a));

    case "mais-vendidos":
      return lista.sort((a, b) => Number(b.vendidos) - Number(a.vendidos));

    case "relevancia":
    default:
      return lista.sort((a, b) => {
        if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;

        const vendidos = Number(b.vendidos) - Number(a.vendidos);
        if (vendidos !== 0) return vendidos;

        const oa = Number(a.ordem) || 999;
        const ob = Number(b.ordem) || 999;

        if (oa !== ob) return oa - ob;

        return Number(b.avaliacao) - Number(a.avaliacao);
      });
  }
}

function normalizarOrdenacao(valor) {
  const texto = normalizarTexto(valor);

  if (texto.includes("menor")) return "menor-preco";
  if (texto.includes("maior")) return "maior-preco";
  if (texto.includes("avali")) return "melhor-avaliados";
  if (texto.includes("novo")) return "novidades";
  if (texto.includes("vend")) return "mais-vendidos";

  return "relevancia";
}


function abrirPopupProduto(id, opcoes = {}) {
  const produto = listaProdutos.find(p => String(p.id) === String(id) || String(p.docId) === String(id));

  if (!produto) return;

  if (opcoes.limparHistorico !== false) {
    historicoProdutosPopup = [];
  }

  produtoAtualPopup = produto;
  midiasProdutoAtual = montarMidiasProduto(produto);
  indiceMidiaAtual = 0;

  const popup = document.getElementById("popup-produto");
  if (!popup) return;

  popup.classList.add("ativo");
  popup.style.display = "flex";
  popup.setAttribute("aria-hidden", "false");
  document.body.classList.add("popup-aberto");

  preencherPopup(produto, true);

  setTimeout(aplicarCorrecaoGaleriaProduto, 60);
}

function abrirProdutoRecomendado(id) {
  if (!id) return;

  const idNovo = String(id);
  const idAtual = produtoAtualPopup ? String(produtoAtualPopup.id || produtoAtualPopup.docId) : "";

  if (idAtual && idAtual !== idNovo) {
    const ultimoHistorico = historicoProdutosPopup[historicoProdutosPopup.length - 1];

    if (String(ultimoHistorico || "") !== idAtual) {
      historicoProdutosPopup.push(idAtual);
    }

    if (historicoProdutosPopup.length > 12) {
      historicoProdutosPopup = historicoProdutosPopup.slice(-12);
    }
  }

  abrirPopupProduto(idNovo, { limparHistorico: false });
  rolarPopupParaTopo();
}

function voltarProdutoAnterior() {
  let idAnterior = historicoProdutosPopup.pop();

  while (idAnterior && !listaProdutos.some(p => String(p.id) === String(idAnterior) || String(p.docId) === String(idAnterior))) {
    idAnterior = historicoProdutosPopup.pop();
  }

  if (!idAnterior) return;

  abrirPopupProduto(idAnterior, { limparHistorico: false });
  rolarPopupParaTopo();
}

function rolarPopupParaTopo() {
  const card = document.querySelector(".popup-produto-card");
  const conteudo = document.querySelector(".popup-conteudo");
  const galeria = document.querySelector(".popup-galeria");

  [card, conteudo, galeria].forEach(el => {
    if (!el) return;

    try {
      el.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (_) {
      el.scrollTop = 0;
    }
  });
}

function preencherPopup(produto, resetarMidia = true) {
  definirTexto("popup-categoria", categoriaPublicaDoProduto(produto));
  definirTexto("popup-nome", produto.nome);
  definirTexto("popup-preco-antigo", produto.precoAntigo || "");
  definirTexto("popup-preco", produto.preco || "Ver preço na loja");

  definirTexto(
    "popup-descricao",
    produto.descricao || "Produto selecionado pela Zyqen Store. Confira todos os detalhes na plataforma oficial."
  );

  const media = document.getElementById("popup-avaliacao-media");
  if (media) media.textContent = produto.avaliacao ? produto.avaliacao.toFixed(1).replace(".", ",") : "Novo";

  const total = document.getElementById("popup-avaliacao-total");
  if (total) {
    const avaliacoes = Number(produto.avaliacoes) || produto.comentarios.length || 0;
    total.textContent = avaliacoes ? `(${avaliacoes} avaliações)` : "Sem avaliações ainda";
  }

  const estrelas = document.getElementById("popup-estrelas");
  if (estrelas) estrelas.innerHTML = gerarEstrelas(produto.avaliacao || 5);

  const precoAntigo = document.getElementById("popup-preco-antigo");
  if (precoAntigo) precoAntigo.style.display = produto.precoAntigo ? "inline" : "none";

  const parcelamento = document.getElementById("popup-parcelamento");
  if (parcelamento) {
    if (produto.parcelamento) {
      parcelamento.innerHTML = `${escaparHTML(produto.parcelamento)}${
        produto.textoParcelamento ? ` <b>${escaparHTML(produto.textoParcelamento)}</b>` : ""
      }`;

      parcelamento.style.display = "inline-flex";
    } else {
      parcelamento.innerHTML = "";
      parcelamento.style.display = "none";
    }
  }

  renderizarFaixaParceiroPopup(produto);

  const destaque = document.getElementById("popup-destaque-parcelamento");
  if (destaque) {
    const texto = produto.textoDestaque || produto.urgencia || "";
    destaque.textContent = texto;
    destaque.style.display = texto ? "block" : "none";
  }

  if (resetarMidia) {
    renderizarMidiaPopup(0);
  } else {
    renderizarMidiaPopup(indiceMidiaAtual);
  }

  renderizarMiniaturas();
  renderizarRecomendadosPopup(produto);
  renderizarDetalhesProduto(produto);
  renderizarBlocoConfianca();
  mostrarComentariosProduto(produto);
  configurarBotaoCompraPopup(produto);
  atualizarContextoChatProduto(produto);
  atualizarSugestoesChatProduto(produto);

  setTimeout(aplicarCorrecaoGaleriaProduto, 80);
}

function fecharPopup() {
  const popup = document.getElementById("popup-produto");

  if (popup) {
    popup.classList.remove("ativo");
    popup.style.display = "none";
    popup.setAttribute("aria-hidden", "true");
  }

  document.body.classList.remove("popup-aberto");
  fecharChatProduto();
  historicoProdutosPopup = [];
}

function configurarBotaoCompraPopup(produto) {
  const botao = document.getElementById("popup-comprar-link");

  if (!botao) return;

  botao.href = produto.link || "#";
  botao.textContent = produto.botao || "Comprar agora";

  botao.onclick = () => {
    registrarCliqueProduto("comprar", produto);
  };
}

function montarMidiasProduto(produto) {
  const imagens = Array.isArray(produto.imagens)
    ? produto.imagens.filter(Boolean).map(src => ({ tipo: "imagem", src }))
    : [];

  const videos = Array.isArray(produto.videos)
    ? produto.videos.filter(Boolean).map(src => ({ tipo: "video", src }))
    : [];

  const midias = [...imagens, ...videos];

  if (!midias.length) midias.push({ tipo: "imagem", src: IMAGEM_FALLBACK });

  return midias;
}

function renderizarMidiaPopup(indice = 0) {
  if (!midiasProdutoAtual.length) return;

  const i = Math.max(0, Math.min(Number(indice) || 0, midiasProdutoAtual.length - 1));
  const midia = midiasProdutoAtual[i];

  indiceMidiaAtual = i;

  const area = document.querySelector(".popup-imagem-area");
  const img = document.getElementById("popup-imagem");
  const contador = document.getElementById("popup-contador-imagem");

  if (!area || !img) return;

  let video = document.getElementById("popup-video");

  if (midia.tipo === "video") {
    img.style.display = "none";

    if (!video) {
      video = document.createElement("video");
      video.id = "popup-video";
      video.controls = true;
      video.playsInline = true;
      video.className = "popup-video";
      area.insertBefore(video, contador || null);
    }

    video.src = midia.src;
    video.style.display = "block";
    video.onloadedmetadata = () => aplicarCorrecaoGaleriaProduto();
  } else {
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.style.display = "none";
    }

    img.style.display = "block";
    img.src = midia.src || IMAGEM_FALLBACK;
    img.alt = produtoAtualPopup?.nome || "Produto";
    img.dataset.imagemAtual = String(i);

    img.onload = () => {
      aplicarCorrecaoGaleriaProduto();
    };

    img.onerror = () => {
      img.onerror = null;
      img.src = IMAGEM_FALLBACK;
    };
  }

  if (contador) contador.textContent = `${i + 1}/${midiasProdutoAtual.length}`;

  document.querySelectorAll(".thumb-midia").forEach((thumb, idx) => {
    thumb.classList.toggle("ativo", idx === i);
  });

  aplicarCorrecaoGaleriaProduto();
}

function renderizarMiniaturas() {
  const thumbs = document.getElementById("popup-thumbs");
  if (!thumbs) return;

  thumbs.innerHTML = midiasProdutoAtual
    .map((midia, i) => {
      const preview = midia.tipo === "imagem" ? midia.src : ICONES_PADRAO.play;

      return `
        <button
          type="button"
          class="thumb-midia ${i === indiceMidiaAtual ? "ativo" : ""}"
          onclick="atualizarImagem(${i})"
          aria-label="Mídia ${i + 1}"
        >
          <img src="${escaparHTML(preview)}" alt="Miniatura ${i + 1}" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'">
          ${midia.tipo === "video" ? `<span class="thumb-play">▶</span>` : ""}
        </button>
      `;
    })
    .join("");

  aplicarCorrecaoGaleriaProduto();
}

function aplicarCorrecaoGaleriaProduto() {
  const area = document.querySelector(".popup-imagem-area");
  const imagem = document.getElementById("popup-imagem");
  const video = document.getElementById("popup-video");
  const thumbs = document.getElementById("popup-thumbs");

  if (!area) return;

  const ehMobile = window.matchMedia("(max-width: 980px)").matches;

  area.style.setProperty("overflow", "hidden", "important");
  area.style.setProperty("display", "grid", "important");
  area.style.setProperty("place-items", "center", "important");
  area.style.setProperty("background", "#ffffff", "important");

  if (ehMobile) {
    ajustarCaixaDaImagemPeloTamanhoReal(area, imagem, video);
  }

  if (imagem) {
    const visivel = imagem.style.display !== "none";

    imagem.style.setProperty("display", visivel ? "block" : "none", "important");
    imagem.style.setProperty("width", "auto", "important");
    imagem.style.setProperty("height", "auto", "important");
    imagem.style.setProperty("max-width", "100%", "important");
    imagem.style.setProperty("max-height", "100%", "important");
    imagem.style.setProperty("object-fit", "contain", "important");
    imagem.style.setProperty("object-position", "center center", "important");
    imagem.style.setProperty("padding", "0", "important");
    imagem.style.setProperty("margin", "0 auto", "important");
    imagem.style.setProperty("background", "#ffffff", "important");
  }

  if (video) {
    video.style.setProperty("width", "auto", "important");
    video.style.setProperty("height", "auto", "important");
    video.style.setProperty("max-width", "100%", "important");
    video.style.setProperty("max-height", "100%", "important");
    video.style.setProperty("object-fit", "contain", "important");
    video.style.setProperty("object-position", "center center", "important");
    video.style.setProperty("padding", "0", "important");
    video.style.setProperty("margin", "0 auto", "important");
  }

  if (thumbs) {
    thumbs.style.setProperty("display", "flex", "important");
    thumbs.style.setProperty("align-items", "center", "important");
    thumbs.style.setProperty("overflow-x", "auto", "important");
    thumbs.style.setProperty("overflow-y", "hidden", "important");

    thumbs.querySelectorAll(".thumb-midia").forEach(thumb => {
      thumb.style.setProperty("display", "grid", "important");
      thumb.style.setProperty("place-items", "center", "important");
      thumb.style.setProperty("overflow", "hidden", "important");
    });

    thumbs.querySelectorAll(".thumb-midia img").forEach(img => {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("max-width", "100%", "important");
      img.style.setProperty("max-height", "100%", "important");
      img.style.setProperty("object-fit", "cover", "important");
      img.style.setProperty("object-position", "center center", "important");
      img.style.setProperty("padding", "0", "important");
      img.style.setProperty("margin", "0", "important");
    });
  }
}

function ajustarCaixaDaImagemPeloTamanhoReal(area, imagem, video) {
  const midiaVisivel = video && video.style.display !== "none" ? video : imagem;

  let larguraNatural = 1;
  let alturaNatural = 1;

  if (midiaVisivel && midiaVisivel.tagName === "VIDEO") {
    larguraNatural = midiaVisivel.videoWidth || 1;
    alturaNatural = midiaVisivel.videoHeight || 1;
  } else if (midiaVisivel) {
    larguraNatural = midiaVisivel.naturalWidth || 1;
    alturaNatural = midiaVisivel.naturalHeight || 1;
  }

  let ratio = larguraNatural / alturaNatural;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    ratio = 1;
  }

  const larguraTela = window.innerWidth || document.documentElement.clientWidth || 390;
  const larguraArea = Math.max(280, Math.min(larguraTela - 24, 760));

  let alturaIdeal = Math.round(larguraArea / ratio);

  const limiteMinimo = larguraTela <= 360 ? 270 : 292;
  const limiteMaximo = Math.min(Math.round(window.innerHeight * 0.56), 440);

  if (ratio >= 1.75) alturaIdeal = Math.max(240, alturaIdeal);
  if (ratio >= 1.25 && ratio < 1.75) alturaIdeal = Math.max(285, alturaIdeal);
  if (ratio >= 0.82 && ratio < 1.25) alturaIdeal = Math.max(330, alturaIdeal);
  if (ratio < 0.82) alturaIdeal = Math.max(360, alturaIdeal);

  const alturaFinal = limitarNumero(alturaIdeal, limiteMinimo, limiteMaximo);

  area.classList.remove("imagem-horizontal", "imagem-quadrada", "imagem-vertical", "imagem-panoramica");

  if (ratio >= 1.75) {
    area.classList.add("imagem-panoramica");
    area.dataset.aspecto = "panoramica";
  } else if (ratio >= 1.25) {
    area.classList.add("imagem-horizontal");
    area.dataset.aspecto = "horizontal";
  } else if (ratio <= 0.82) {
    area.classList.add("imagem-vertical");
    area.dataset.aspecto = "vertical";
  } else {
    area.classList.add("imagem-quadrada");
    area.dataset.aspecto = "quadrada";
  }

  area.style.setProperty("width", "100%", "important");
  area.style.setProperty("height", `${alturaFinal}px`, "important");
  area.style.setProperty("min-height", `${alturaFinal}px`, "important");
  area.style.setProperty("max-height", `${alturaFinal}px`, "important");
  area.style.setProperty("aspect-ratio", `${larguraNatural} / ${alturaNatural}`, "important");
}

function limitarNumero(numero, minimo, maximo) {
  return Math.max(minimo, Math.min(numero, maximo));
}

function renderizarRecomendadosPopup(produto) {
  const box = document.getElementById("popup-recomendados") || document.querySelector(".zq-popup-recomendados");
  if (!box || !produto) return;

  const idAtual = String(produto.id || produto.docId);
  const voltarHTML = gerarHTMLVoltarProdutoAnterior();

  const recomendados = listaProdutos
    .filter(item => String(item.id || item.docId) !== idAtual)
    .sort((a, b) => {
      const mesmoDepartamentoA = a.departamentoSlug === produto.departamentoSlug ? 0 : 1;
      const mesmoDepartamentoB = b.departamentoSlug === produto.departamentoSlug ? 0 : 1;

      if (mesmoDepartamentoA !== mesmoDepartamentoB) return mesmoDepartamentoA - mesmoDepartamentoB;
      if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;

      return Number(b.avaliacao) - Number(a.avaliacao);
    })
    .slice(0, 2);

  if (!recomendados.length) {
    box.innerHTML = `
      ${voltarHTML}
      <div class="zq-popup-recomendados-top">
        <strong>Veja também</strong>
        <span>Outras opções</span>
      </div>
      <p class="zq-popup-recomendados-vazio">Quando houver mais produtos ativos, eles vão aparecer aqui automaticamente.</p>
    `;

    return;
  }

  box.innerHTML = `
    ${voltarHTML}

    <div class="zq-popup-recomendados-top">
      <strong>Veja também</strong>
      <span>Toque para abrir</span>
    </div>

    <div class="zq-popup-recomendados-grid">
      ${recomendados
        .map(
          item => `
          <button type="button" class="zq-popup-recomendado-item" data-popup-recomendado="${escaparHTML(item.id || item.docId)}">
            <img src="${escaparHTML(imagemPrincipal(item))}" alt="${escaparHTML(item.nome)}" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'">
            <span>
              <strong>${escaparHTML(item.nome)}</strong>
              <small>${escaparHTML(item.preco || "Ver preço")}</small>
            </span>
          </button>
        `
        )
        .join("")}
    </div>
  `;
}

function gerarHTMLVoltarProdutoAnterior() {
  if (!historicoProdutosPopup.length) return "";

  const idAnterior = historicoProdutosPopup[historicoProdutosPopup.length - 1];
  const produtoAnterior = listaProdutos.find(
    item => String(item.id) === String(idAnterior) || String(item.docId) === String(idAnterior)
  );

  const texto = produtoAnterior
    ? `Voltar para ${cortarTexto(produtoAnterior.nome, 34)}`
    : "Voltar ao produto anterior";

  return `
    <button type="button" class="zq-popup-voltar-produto" data-voltar-produto>
      <span>←</span>
      <strong>${escaparHTML(texto)}</strong>
    </button>
  `;
}

function atualizarImagem(i) {
  renderizarMidiaPopup(i);
}

function proximaImagemPopup() {
  const proxima = (indiceMidiaAtual + 1) % Math.max(1, midiasProdutoAtual.length);
  renderizarMidiaPopup(proxima);
}

function imagemAnteriorPopup() {
  const anterior = (indiceMidiaAtual - 1 + Math.max(1, midiasProdutoAtual.length)) % Math.max(
    1,
    midiasProdutoAtual.length
  );

  renderizarMidiaPopup(anterior);
}

function ativarSwipeImagem() {
  let inicioX = 0;
  let inicioY = 0;

  document.addEventListener(
    "touchstart",
    event => {
      const area = event.target.closest?.(".popup-imagem-area");
      if (!area) return;

      inicioX = event.touches[0].clientX;
      inicioY = event.touches[0].clientY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    event => {
      const area = event.target.closest?.(".popup-imagem-area");
      if (!area) return;

      const fimX = event.changedTouches[0].clientX;
      const fimY = event.changedTouches[0].clientY;

      const dx = fimX - inicioX;
      const dy = fimY - inicioY;

      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) proximaImagemPopup();
        else imagemAnteriorPopup();
      }
    },
    { passive: true }
  );
}

function faixaParceiroDoProduto(produto) {
  const id = String(produto?.faixaParceiroId || "").trim();

  if (!id) return null;

  const todasFaixas = listaFaixasParceiros.length
    ? listaFaixasParceiros
    : FAIXAS_PARCEIROS_PADRAO.map(normalizarFaixaParceiro);

  return todasFaixas.find(faixa =>
    String(faixa.slug) === id ||
    String(faixa.docId) === id ||
    String(faixa.nome) === id
  ) || null;
}

function renderizarFaixaParceiroPopup(produto) {
  const faixaEl = document.getElementById("popup-faixa-parceiro");

  if (!faixaEl) return;

  const faixa = faixaParceiroDoProduto(produto);

  if (!faixa) {
    faixaEl.textContent = "";
    faixaEl.removeAttribute("style");
    faixaEl.style.setProperty("display", "none", "important");
    return;
  }

  const cor = faixa.cor || "#b98a37";
  const opacidade = Number(faixa.opacidade) || 0.18;
  const ehMobile = window.innerWidth <= 680;

  faixaEl.textContent = faixa.nome;

  faixaEl.style.setProperty("display", "inline-flex", "important");

  faixaEl.style.setProperty(
    "background",
    corComOpacidade(cor, opacidade),
    "important"
  );

  faixaEl.style.setProperty(
    "border-color",
    corComOpacidade(cor, Math.min(0.95, opacidade + 0.32)),
    "important"
  );


  faixaEl.style.setProperty("color", "#111111", "important");


  faixaEl.style.setProperty("font-size", ehMobile ? "12px" : "13px", "important");
  faixaEl.style.setProperty("font-weight", "950", "important");
  faixaEl.style.setProperty("letter-spacing", "0.01em", "important");


  faixaEl.style.setProperty("min-height", ehMobile ? "28px" : "31px", "important");
  faixaEl.style.setProperty("padding", ehMobile ? "6px 12px" : "7px 14px", "important");

  faixaEl.style.setProperty(
    "box-shadow",
    `0 8px 22px ${corComOpacidade(cor, 0.12)}`,
    "important"
  );
}

function renderizarDetalhesProduto(produto) {
  const detalhes = document.getElementById("popup-detalhes");
  if (!detalhes) return;

  const lista = Array.isArray(produto.detalhes) ? produto.detalhes.filter(Boolean) : [];

  detalhes.innerHTML = `
    <div class="produto-detalhes-card">
      <h3>Características do Produto</h3>
      ${
        lista.length
          ? `<ul>${lista.map(item => `<li>${formatarDetalhe(item)}</li>`).join("")}</ul>`
          : `<p>As principais informações estão na descrição e na página oficial da oferta.</p>`
      }
    </div>
  `;
}

function formatarDetalhe(item) {
  if (typeof item === "string") return escaparHTML(item);

  const nome = item.nome || item.titulo || item.chave || "Detalhe";
  const valor = item.valor || item.texto || item.descricao || "";

  return `<strong>${escaparHTML(nome)}:</strong> ${escaparHTML(valor)}`;
}



function selosPadrao() {
  return [
    {
      titulo: "Compra na plataforma",
      texto: "Você finaliza a compra direto na loja parceira.",
      icone: ICONES_PADRAO.escudo
    },
    {
      titulo: "Sem pagamento no site",
      texto: "A Zyqen Store não coleta cartão, senha ou dados bancários.",
      icone: ICONES_PADRAO.cadeado
    },
    {
      titulo: "Produto selecionado",
      texto: "Produto organizado para facilitar sua escolha.",
      icone: ICONES_PADRAO.estrela
    }
  ];
}

function renderizarBlocoConfianca() {
  const bloco = document.getElementById("popup-confianca-bloco");
  if (!bloco) return;

  bloco.innerHTML = `
    <div class="popup-confianca-grid">
      ${selosPadrao()
        .map(
          selo => `
          <div class="popup-confianca-item">
            <span>${renderizarIcone(selo.icone)}</span>
            <div>
              <strong>${escaparHTML(selo.titulo)}</strong>
              <p>${escaparHTML(selo.texto)}</p>
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

function mostrarComentariosProduto(produto) {
  const container = document.getElementById("popup-observacoes");
  if (!container) return;

  const comentarios = Array.isArray(produto.comentarios) ? produto.comentarios : [];
  const observacoes = Array.isArray(produto.observacoes) ? produto.observacoes.filter(Boolean) : [];

  const htmlObservacoes = observacoes.length
    ? `
      <div class="produto-observacoes-card">
        <h3>Observações</h3>
        <ul>
          ${observacoes
            .map(o => `<li>${escaparHTML(typeof o === "string" ? o : o.texto || o.descricao || "")}</li>`)
            .join("")}
        </ul>
      </div>
    `
    : "";

  const htmlComentarios = comentarios
    .slice()
    .reverse()
    .map(c => {
      const nome = c.nome || c.autor || "Cliente";
      const texto = c.texto || c.comentario || "";
      const nota = Number(c.nota || c.avaliacao || 5);

      return `
        <article class="comentario-item">
          <div class="comentario-topo">
            <strong>${escaparHTML(nome)}</strong>
            <span>${gerarEstrelas(nota)}</span>
          </div>
          <p>${escaparHTML(texto)}</p>
        </article>
      `;
    })
    .join("");

  container.innerHTML = `
    ${htmlObservacoes}

    <div class="comentarios-produto">
      <div class="comentarios-topo">
        <h3>Comentários</h3>
        <button type="button" onclick="toggleComentarios()">Mostrar/ocultar</button>
      </div>

      <div id="lista-comentarios-produto" class="lista-comentarios-produto aberto">
        ${htmlComentarios || `<p class="comentario-vazio">Ainda não há comentários para este produto.</p>`}
      </div>

      <form id="form-comentario-produto" class="form-comentario-produto">
        <input type="text" id="comentario-nome" placeholder="Seu nome" maxlength="40" required>

        <select id="comentario-nota" required>
          <option value="5">5 estrelas</option>
          <option value="4">4 estrelas</option>
          <option value="3">3 estrelas</option>
          <option value="2">2 estrelas</option>
          <option value="1">1 estrela</option>
        </select>

        <textarea id="comentario-texto" placeholder="Escreva seu comentário" maxlength="240" required></textarea>

        <button type="submit">Enviar comentário</button>
      </form>
    </div>
  `;
}

function toggleComentarios() {
  const lista = document.getElementById("lista-comentarios-produto");
  if (lista) lista.classList.toggle("aberto");
}

function prepararFormularioComentario() {
  document.addEventListener("submit", async event => {
    const form = event.target.closest?.("#form-comentario-produto");
    if (!form) return;

    event.preventDefault();

    if (comentarioEnviando || !produtoAtualPopup?.docId) return;

    const btn = form.querySelector("button[type='submit']");
    const nome = document.getElementById("comentario-nome")?.value.trim();
    const texto = document.getElementById("comentario-texto")?.value.trim();
    const nota = Number(document.getElementById("comentario-nota")?.value || 5);

    if (!nome || !texto) return;

    comentarioEnviando = true;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando...";
    }

    try {
      const ref = doc(db, "produtos", produtoAtualPopup.docId);

      await updateDoc(ref, {
        comentarios: arrayUnion({
          nome,
          texto,
          nota,
          tipo: "real",
          data: new Date().toISOString()
        })
      });

      form.reset();
      abrirPopupSucessoComentario();
    } catch (erro) {
      console.warn("Erro ao enviar comentário.", erro);
      alert("Não foi possível enviar o comentário agora.");
    } finally {
      comentarioEnviando = false;

      if (btn) {
        btn.disabled = false;
        btn.textContent = "Enviar comentário";
      }
    }
  });
}

function abrirPopupSucessoComentario() {
  const popup = document.getElementById("popup-sucesso-comentario");
  if (!popup) return;

  popup.style.display = "flex";
  popup.classList.add("ativo");
}

function fecharPopupSucessoComentario() {
  const popup = document.getElementById("popup-sucesso-comentario");
  if (!popup) return;

  popup.classList.remove("ativo");
  popup.style.display = "none";
}



async function registrarCliqueProduto(tipo, produto = produtoAtualPopup) {
  if (typeof produto === "string") {
    produto = listaProdutos.find(p => String(p.docId) === produto || String(p.id) === produto);
  }

  if (!produto?.docId) return;

  const campoPorTipo = {
    comprar: "cliquesComprar",
    whatsapp: "cliquesWhatsapp",
    compartilhar: "cliquesCompartilhar",
    instagram: "cliquesInstagram"
  };

  const campo = campoPorTipo[tipo];
  if (!campo) return;

  const chave = `${produto.docId}-${tipo}`;
  if (cliquesEmAndamento.has(chave)) return;

  cliquesEmAndamento.add(chave);

  try {
    const ref = doc(db, "produtos", produto.docId);

    await updateDoc(ref, {
      [campo]: increment(1),
      cliquesTotal: increment(1)
    });
  } catch (erro) {
    console.warn("Clique não registrado.", erro);
  } finally {
    setTimeout(() => cliquesEmAndamento.delete(chave), 700);
  }
}

async function compartilharProduto() {
  if (!produtoAtualPopup) return;

  await registrarCliqueProduto("compartilhar", produtoAtualPopup);

  const url = produtoAtualPopup.link || window.location.href;
  const texto = `${produtoAtualPopup.nome} - ${produtoAtualPopup.preco || "Oferta Zyqen Store"}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: produtoAtualPopup.nome,
        text: texto,
        url
      });

      return;
    } catch (_) {}
  }

  try {
    await navigator.clipboard.writeText(url);
    alert("Link copiado!");
  } catch (_) {
    prompt("Copie o link:", url);
  }
}

function abrirWhatsappProduto() {
  if (!produtoAtualPopup) return;

  registrarCliqueProduto("whatsapp", produtoAtualPopup);

  const msg =
    produtoAtualPopup.mensagemWhatsapp ||
    `Olá, vim pelo site Zyqen Store e quero saber mais sobre: ${produtoAtualPopup.nome}`;

  window.open(`https://wa.me/${TELEFONE_WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
}

function abrirInstagramZyqen(url = "https://www.instagram.com/zyqen_oficial") {
  if (produtoAtualPopup) registrarCliqueProduto("instagram", produtoAtualPopup);
  window.open(url, "_blank", "noopener");
}


function prepararChatProduto() {
  if (chatProdutoInicializado) return;
  chatProdutoInicializado = true;

  const form = document.getElementById("chat-produto-form");
  const input = document.getElementById("chat-produto-input");
  const sugestoes = document.getElementById("chat-produto-sugestoes");
  const topo = document.getElementById("chat-produto-topo");
  const whatsapp = document.getElementById("chat-produto-whatsapp");

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();

      const pergunta = input?.value.trim();
      if (!pergunta) return;

      enviarPerguntaChatProduto(pergunta);
      input.value = "";
    });
  }

  if (sugestoes) {
    sugestoes.addEventListener("click", event => {
      const btn = event.target.closest("button[data-pergunta]");
      if (!btn) return;

      enviarPerguntaChatProduto(btn.dataset.pergunta || btn.textContent.trim());
    });
  }

  if (whatsapp) whatsapp.addEventListener("click", abrirWhatsappProduto);

  if (topo) {
    topo.addEventListener("pointerdown", iniciarArrastoChat);
    document.addEventListener("pointermove", arrastarChat);
    document.addEventListener("pointerup", pararArrastoChat);
  }
}

function abrirChatProduto() {
  const chat = document.getElementById("chat-produto-widget");
  if (!chat) return;

  chat.hidden = false;
  chat.setAttribute("aria-hidden", "false");
  chat.classList.add("ativo");

  atualizarContextoChatProduto(produtoAtualPopup);
  atualizarSugestoesChatProduto(produtoAtualPopup);
  manterChatDentroDaTela();
}

function fecharChatProduto() {
  const chat = document.getElementById("chat-produto-widget");
  if (!chat) return;

  chat.classList.remove("ativo", "minimizado");
  chat.setAttribute("aria-hidden", "true");
  chat.hidden = true;
}

function minimizarChatProduto() {
  const card = document.getElementById("chat-produto-card");
  if (card) card.classList.toggle("minimizado");
}

function enviarPerguntaChatProduto(pergunta) {
  const mensagens = document.getElementById("chat-produto-mensagens");
  if (!mensagens) return;

  mensagens.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-msg chat-msg-user"><p>${escaparHTML(pergunta)}</p></div>`
  );

  const resposta = responderPerguntaProduto(pergunta, produtoAtualPopup);

  setTimeout(() => {
    mensagens.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-msg chat-msg-bot"><p>${escaparHTML(resposta)}</p></div>`
    );

    mensagens.scrollTop = mensagens.scrollHeight;
  }, 180);

  mensagens.scrollTop = mensagens.scrollHeight;
}

function responderPerguntaProduto(pergunta, produto) {
  if (!produto) return "Abra um produto primeiro para eu conseguir te ajudar melhor.";

  const t = normalizarTexto(pergunta);

  if (t.includes("preco") || t.includes("valor") || t.includes("quanto")) {
    return `O preço mostrado é ${produto.preco || "ver preço na loja"}. Confira o valor final na plataforma oficial antes de comprar.`;
  }

  if (t.includes("parcel") || t.includes("juros")) {
    return produto.parcelamento
      ? `Esse produto aparece com parcelamento: ${produto.parcelamento}${produto.textoParcelamento ? ` ${produto.textoParcelamento}` : ""}.`
      : "Não encontrei parcelamento cadastrado nesse produto. Confira as condições direto na loja oficial.";
  }

  if (t.includes("seguro") || t.includes("confiavel") || t.includes("confiança")) {
    return "A Zyqen Store é uma vitrine. O pagamento não acontece aqui no site; você é redirecionado para a plataforma parceira.";
  }

  if (t.includes("caracteristica") || t.includes("detalhe") || t.includes("informacao")) {
    const detalhes = Array.isArray(produto.detalhes) ? produto.detalhes : [];

    if (detalhes.length) {
      return `Principais características: ${detalhes
        .slice(0, 4)
        .map(d => (typeof d === "string" ? d : `${d.nome || d.titulo || "Detalhe"}: ${d.valor || d.texto || d.descricao || ""}`))
        .join("; ")}.`;
    }

    return "Não encontrei características extras cadastradas. Veja a descrição e confirme tudo na página oficial do produto.";
  }

  if (t.includes("entrega") || t.includes("frete") || t.includes("prazo")) {
    return "Frete e prazo são definidos pela plataforma parceira no momento da compra.";
  }

  if (t.includes("whatsapp") || t.includes("atendente") || t.includes("humano")) {
    return "Você pode clicar em 'Chamar no WhatsApp' aqui no robô para falar direto com a Zyqen Store.";
  }

  return "Esse produto foi organizado na Zyqen Store para facilitar sua escolha. Confira preço, descrição e características; a compra final é feita na plataforma parceira.";
}

function atualizarContextoChatProduto(produto) {
  if (!produto) return;

  const img = document.getElementById("chat-produto-img");
  const nome = document.getElementById("chat-produto-nome");
  const preco = document.getElementById("chat-produto-preco");

  if (img) {
    img.src = imagemPrincipal(produto);
    img.onerror = () => {
      img.onerror = null;
      img.src = IMAGEM_FALLBACK;
    };
  }

  if (nome) nome.textContent = produto.nome;
  if (preco) preco.textContent = produto.preco || "Tire suas dúvidas";
}

function atualizarSugestoesChatProduto(produto) {
  const sugestoes = document.getElementById("chat-produto-sugestoes");
  if (!sugestoes) return;

  const perguntas = ["Qual o preço?", "É seguro comprar?", "Tem parcelamento?", "Quais características?"];

  if (produto?.parcelamento) perguntas.unshift("Como funciona o parcelamento?");

  sugestoes.innerHTML = perguntas
    .slice(0, 5)
    .map(pergunta => `<button type="button" data-pergunta="${escaparHTML(pergunta)}">${escaparHTML(pergunta)}</button>`)
    .join("");
}

function iniciarArrastoChat(event) {
  const card = document.getElementById("chat-produto-card");
  if (!card || card.classList.contains("minimizado")) return;
  if (event.target.closest("button")) return;

  chatArrastando = true;

  const rect = card.getBoundingClientRect();

  chatOffsetX = event.clientX - rect.left;
  chatOffsetY = event.clientY - rect.top;

  card.classList.add("arrastando");
}

function arrastarChat(event) {
  if (!chatArrastando) return;

  const card = document.getElementById("chat-produto-card");
  if (!card) return;

  const margem = 10;
  const largura = card.offsetWidth;
  const altura = card.offsetHeight;

  let left = event.clientX - chatOffsetX;
  let top = event.clientY - chatOffsetY;

  left = Math.max(margem, Math.min(left, window.innerWidth - largura - margem));
  top = Math.max(margem, Math.min(top, window.innerHeight - altura - margem));

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.right = "auto";
  card.style.bottom = "auto";
}

function pararArrastoChat() {
  if (!chatArrastando) return;

  chatArrastando = false;

  const card = document.getElementById("chat-produto-card");
  if (card) card.classList.remove("arrastando");
}

function manterChatDentroDaTela() {
  const card = document.getElementById("chat-produto-card");
  if (!card || card.closest("#chat-produto-widget")?.hidden) return;

  const rect = card.getBoundingClientRect();
  const margem = 10;

  let left = rect.left;
  let top = rect.top;

  if (rect.right > window.innerWidth - margem) left -= rect.right - (window.innerWidth - margem);
  if (rect.bottom > window.innerHeight - margem) top -= rect.bottom - (window.innerHeight - margem);

  if (left < margem) left = margem;
  if (top < margem) top = margem;

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.right = "auto";
  card.style.bottom = "auto";
}


function hexParaRgb(hex) {
  const valor = String(hex || "#b98a37").replace("#", "").trim();
  const normalizado = valor.length === 3
    ? valor.split("").map(c => c + c).join("")
    : valor.padEnd(6, "0").slice(0, 6);

  const numeroHex = parseInt(normalizado, 16);

  return {
    r: (numeroHex >> 16) & 255,
    g: (numeroHex >> 8) & 255,
    b: numeroHex & 255
  };
}

function corComOpacidade(hex, opacidade = 0.18) {
  const rgb = hexParaRgb(hex);
  const op = Math.max(0.05, Math.min(1, Number(opacidade) || 0.18));

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${op})`;
}

function imagemPrincipal(produto) {
  return Array.isArray(produto?.imagens) && produto.imagens[0] ? produto.imagens[0] : IMAGEM_FALLBACK;
}

function gerarEstrelas(nota = 5) {
  const valor = Math.max(0, Math.min(5, Number(nota) || 0));
  const cheias = Math.round(valor);

  return Array.from({ length: 5 })
    .map((_, i) => {
      const opacidade = i < cheias ? "1" : ".25";
      return `<img src="${ESTRELA_SVG}" alt="★" style="opacity:${opacidade}">`;
    })
    .join("");
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function textoBuscaProduto(produto) {
  return normalizarTexto(
    [
      produto.nome,
      produto.descricao,
      produto.categoria,
      produto.plataforma,
      produto.departamento,
      produto.subcategoria,
      produto.selo,
      produto.urgencia,
      produto.preco,
      produto.tipoDestaque
    ].join(" ")
  );
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

function numeroPreco(valor) {
  const limpo = String(valor || "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(limpo) || 0;
}

function dataProduto(produto) {
  const valor = produto?.criadoEm || produto?.createdAt || produto?.atualizadoEm;

  if (valor?.toMillis) return valor.toMillis();
  if (valor?.seconds) return valor.seconds * 1000;

  return Number(produto?.id) || 0;
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cortarTexto(texto, limite = 42) {
  const valor = String(texto || "").trim();

  if (valor.length <= limite) return valor;

  return `${valor.slice(0, limite).trim()}...`;
}

function renderizarIcone(icone) {
  const valor = String(icone || "").trim();

  if (!valor) return "✦";

  if (
    valor.includes("/") ||
    valor.endsWith(".svg") ||
    valor.endsWith(".png") ||
    valor.endsWith(".webp") ||
    valor.endsWith(".jpg")
  ) {
    return `<img src="${escaparHTML(valor)}" alt="" onerror="this.style.display='none'">`;
  }

  return escaparHTML(valor);
}

function nomePublicoPlataforma(slugOuNome) {
  const slug = slugify(slugOuNome);
  return NOMES_PUBLICOS_PLATAFORMA[slug] || "Produtos selecionados";
}

function categoriaPublicaDoProduto(produto) {
  const sub = String(produto.subcategoria || "").trim();
  const dep = String(produto.departamento || "").trim();

  if (sub && slugify(sub) !== "geral") return sub;
  if (dep && slugify(dep) !== "geral") return dep;

  return nomePublicoPlataforma(produto.plataformaSlug || produto.categoriaSlug || produto.plataforma || produto.categoria);
}

function nomeCategoriaPorSlug(slug, tipo) {
  const produtos = listaProdutos.filter(produto => {
    if (tipo === "departamento") return produto.departamentoSlug === slug;
    if (tipo === "subcategoria") return produto.subcategoriaSlug === slug;

    return produto.plataformaSlug === slug || produto.categoriaSlug === slug;
  });

  const produto = produtos[0];

  if (!produto) return "Produtos selecionados";
  if (tipo === "departamento") return produto.departamento || "Produtos selecionados";
  if (tipo === "subcategoria") return produto.subcategoria || "Produtos selecionados";

  return nomePublicoPlataforma(slug);
}

function mostrarErroProdutos(texto) {
  const alvo =
    document.getElementById("produtos-grid") ||
    document.getElementById("listaProdutos") ||
    document.getElementById("categorias-container") ||
    document.querySelector("[data-produtos-grid]");

  if (!alvo) return;

  alvo.innerHTML = `
    <section class="zq-empty-products">
      <span>Erro</span>
      <h2>Produtos não carregaram</h2>
      <p>${escaparHTML(texto)}</p>
    </section>
  `;
}

function definirTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto || "";
}

function registrarPWA() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/zyqen-store/sw.js").catch(() => {
      console.warn("Service Worker não registrado. Verifique se o arquivo sw.js existe.");
    });
  });
}


function injetarEstilosMinimosDoScript() {
  if (document.getElementById("zyqen-script-min-style")) return;

  const style = document.createElement("style");
  style.id = "zyqen-script-min-style";

  style.textContent = `
    .popup-produto,
    .popup-sucesso-comentario {
      display: none;
    }

    .popup-produto.ativo,
    .popup-sucesso-comentario.ativo {
      display: flex;
    }

    .popup-faixa-parceiro {
      width: max-content;
      max-width: 100%;
      min-height: 22px;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 6px;
      padding: 4px 10px;
      border: 1px solid rgba(185, 138, 55, .22);
      border-radius: 999px;
      background: rgba(47, 143, 85, .12);
      color: #2f8f55;
      font-size: 11px;
      font-weight: 900;
      line-height: 1;
      white-space: nowrap;
    }

    .popup-faixa-parceiro::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      opacity: .9;
    }

    .btn-whatsapp-popup {
      display: none !important;
    }

    .zq-popup-voltar-produto {
      width: 100%;
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      margin: 0 0 10px;
      padding: 8px 10px;
      border-radius: 13px;
      border: 1px solid #e8e2d7;
      background: #fff8ed;
      color: #8a601f;
      text-align: left;
      cursor: pointer;
      transition: 0.18s ease;
    }

    .zq-popup-voltar-produto:hover {
      background: #fff3df;
      border-color: #d9c6a6;
    }

    .zq-popup-voltar-produto span {
      width: 24px;
      height: 24px;
      min-width: 24px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: #ffffff;
      border: 1px solid #e8e2d7;
      color: #8a601f;
      font-size: 16px;
      font-weight: 900;
      line-height: 1;
    }

    .zq-popup-voltar-produto strong {
      min-width: 0;
      display: block;
      overflow: hidden;
      color: #8a601f;
      font-size: 12px;
      font-weight: 850;
      line-height: 1.2;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .zq-popup-recomendado-item {
      cursor: pointer;
    }

    .zq-popup-recomendado-item:active {
      transform: scale(0.99);
    }

    @media (max-width: 980px) {
      .popup-faixa-parceiro {
        min-height: 24px;
        padding: 5px 10px;
        font-size: 11px;
        margin-top: 6px;
      }
    }

    .estrelas-mini,
    #popup-estrelas,
    .comentario-topo span {
      display: inline-flex;
      gap: 2px;
      align-items: center;
    }

    .estrelas-mini img,
    #popup-estrelas img,
    .comentario-topo span img {
      width: 14px;
      height: 14px;
    }
  `;

  document.head.appendChild(style);
}


window.abrirPaginaProduto = abrirPaginaProduto;
window.abrirPopupProduto = abrirPaginaProduto;
window.abrirProdutoRecomendado = abrirProdutoRecomendado;
window.voltarProdutoAnterior = voltarProdutoAnterior;
window.fecharPopup = fecharPopup;
window.atualizarImagem = atualizarImagem;
window.proximaImagemPopup = proximaImagemPopup;
window.imagemAnteriorPopup = imagemAnteriorPopup;

window.filtrarRapido = filtrarRapido;
window.limparFiltrosHierarquia = limparFiltrosHierarquia;
window.filtrarCategoria = filtrarCategoria;
window.filtrarPlataforma = filtrarPlataforma;
window.filtrarDepartamento = filtrarDepartamento;
window.filtrarSubcategoria = filtrarSubcategoria;
window.trocarPaginaProdutos = trocarPaginaProdutos;

window.compartilharProduto = compartilharProduto;
window.abrirWhatsappProduto = abrirWhatsappProduto;
window.abrirInstagramZyqen = abrirInstagramZyqen;
window.registrarCliqueProduto = registrarCliqueProduto;

window.toggleComentarios = toggleComentarios;
window.abrirPopupSucessoComentario = abrirPopupSucessoComentario;
window.fecharPopupSucessoComentario = fecharPopupSucessoComentario;

window.abrirChatProduto = abrirChatProduto;
window.fecharChatProduto = fecharChatProduto;
window.minimizarChatProduto = minimizarChatProduto;
window.enviarPerguntaChatProduto = enviarPerguntaChatProduto;
window.bloquearZoomMobile = bloquearZoomMobile;
