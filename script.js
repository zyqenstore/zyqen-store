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

/* =========================================================
   VARIÁVEIS GERAIS
========================================================= */

let listaProdutos = [];
let listaCategorias = [];
let produtoAtualPopup = null;
let midiasProdutoAtual = [];
let comentarioEnviando = false;

let plataformaAtual = "Todos";
let departamentoAtual = "Todos";
let subcategoriaAtual = "Todos";
let categoriaAtual = "Todos";

let paginasCategorias = {};
let ordenarAtual = "relevancia";
let filtroRapidoAtual = "todos";
let cliquesEmAndamento = new Set();
let timerDetectarDispositivo = null;
let selosConfianca = [];

let chatProdutoAberto = false;
let chatProdutoInicializado = false;
let chatArrastando = false;
let chatOffsetX = 0;
let chatOffsetY = 0;

const BASE_ICONES_PRODUTO = "imagens/pagina-produtos/";
const PRODUTOS_POR_PAGINA = 8;
const TELEFONE_WHATSAPP = "5575981768068";

const ESTRELA_CHEIA_AMARELA =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#facc15" stroke="#eab308" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>
`);

const ICONES = {
  star: "imagens/icones/star.svg",
  starCheia: ESTRELA_CHEIA_AMARELA,
  circleCheck: "imagens/icones/circle-check.svg",
  triangleAlert: "imagens/icones/triangle-alert.svg",
  messageSquare: "imagens/icones/message-square.svg",
  chevronDown: "imagens/icones/chevron-down.svg",
  chevronLeft: "imagens/icones/chevron-left.svg",
  chevronRight: "imagens/icones/chevron-right.svg",
  play: "imagens/icones/play.svg",
  send: "imagens/icones/send.svg",
  package: "imagens/icones/package.svg",
  shoppingCart: "imagens/icones/shopping-cart.svg",
  search: "imagens/icones/search.svg",
  truck: BASE_ICONES_PRODUTO + "truck.svg",
  checkSquare: BASE_ICONES_PRODUTO + "check-square.svg",
  rotate: BASE_ICONES_PRODUTO + "rotate.svg",
  shield: BASE_ICONES_PRODUTO + "shield.svg",
  clipboardList: BASE_ICONES_PRODUTO + "clipboard-list.svg",
  creditCard: BASE_ICONES_PRODUTO + "credit-card.svg",
  cart: BASE_ICONES_PRODUTO + "shopping-cart.svg"
};

const CORES_ICONES_SELOS = {
  frete: "verde",
  loja: "verde",
  devolucao: "azul",
  garantia: "azul"
};

const IMAGEM_FALLBACK =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 700 500">
  <rect width="700" height="500" fill="#020617"/>
  <rect x="30" y="30" width="640" height="440" rx="32" fill="#0f172a" stroke="#334155" stroke-width="4"/>
  <circle cx="250" cy="210" r="50" fill="#1e293b"/>
  <path d="M120 390 L280 260 L390 350 L470 290 L590 390 Z" fill="#1e293b"/>
  <text x="350" y="448" text-anchor="middle" fill="#94a3b8" font-size="28" font-family="Arial">Imagem não encontrada</text>
</svg>
`);

/* =========================================================
   INICIAR SITE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  detectarDispositivo();
  bloquearZoomSite();
  ajustarSiteFixo();

  injetarEstiloBuscaInteligente();
  injetarEstiloPaginacao();
  injetarEstiloIconesJS();
  injetarEstiloChat();

  criarControlesBuscaInteligente();
  garantirEstruturaDinamica();

  carregarCategoriasFirebase();
  carregarProdutosFirebase();
  carregarSelosConfianca();

  prepararFormularioComentario();
  prepararCliquesInstagram();
  prepararChatProduto();
  ativarSwipeImagem();
  prepararConfiancaMobile();

  const pesquisa = document.getElementById("pesquisa");

  if (pesquisa) {
    pesquisa.addEventListener("input", () => {
      resetarPaginas();
      aplicarFiltros();
    });
  }

  window.addEventListener("resize", () => {
    agendarDetectarDispositivo();
    manterChatDentroDaTela();
  });

  window.addEventListener("orientationchange", () => {
    agendarDetectarDispositivo();
    setTimeout(manterChatDentroDaTela, 250);
  });
});

/* =========================================================
   DISPOSITIVO / ZOOM
========================================================= */

function detectarDispositivo() {
  const html = document.documentElement;
  const body = document.body;

  if (!body) return;

  const largura = window.innerWidth || html.clientWidth || 0;
  const ehTouch =
    "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  const ponteiroFino = window.matchMedia("(pointer: fine)").matches;
  const hoverReal = window.matchMedia("(hover: hover)").matches;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );

  const classesDispositivo = [
    "modo-mobile",
    "modo-tablet",
    "modo-desktop",
    "tem-touch",
    "sem-touch"
  ];

  html.classList.remove(...classesDispositivo);
  body.classList.remove(...classesDispositivo);

  let dispositivo = "desktop";

  if (largura <= 768 || mobileUserAgent) {
    dispositivo = "mobile";
  } else if (largura <= 1180 || (ehTouch && largura <= 1366 && !(ponteiroFino && hoverReal))) {
    dispositivo = "tablet";
  }

  const classeDispositivo = `modo-${dispositivo}`;
  const classeTouch = ehTouch ? "tem-touch" : "sem-touch";

  html.classList.add(classeDispositivo, classeTouch);
  body.classList.add(classeDispositivo, classeTouch);
  html.dataset.dispositivo = dispositivo;
  body.dataset.dispositivo = dispositivo;
}

function agendarDetectarDispositivo() {
  clearTimeout(timerDetectarDispositivo);

  timerDetectarDispositivo = setTimeout(() => {
    detectarDispositivo();
  }, 120);
}

function bloquearZoomSite() {
  const html = document.documentElement;
  const body = document.body;
  const ehMobile = window.matchMedia("(max-width: 900px)").matches;

  html.style.overflowX = "hidden";
  html.style.maxWidth = "100%";
  body.style.overflowX = "hidden";
  body.style.maxWidth = "100%";

  if (!ehMobile) {
    html.style.touchAction = "auto";
    body.style.touchAction = "auto";
    return;
  }

  html.style.touchAction = "manipulation";
  body.style.touchAction = "manipulation";

  const impedir = event => event.preventDefault();

  document.addEventListener("gesturestart", impedir, { passive: false });
  document.addEventListener("gesturechange", impedir, { passive: false });
  document.addEventListener("gestureend", impedir, { passive: false });

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
      if (!window.matchMedia("(max-width: 900px)").matches) return;

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (!window.matchMedia("(max-width: 900px)").matches) return;

      const tecla = String(event.key || "").toLowerCase();
      const teclaZoom = ["+", "-", "=", "0", "_", "add", "subtract"].includes(tecla);

      if ((event.ctrlKey || event.metaKey) && teclaZoom) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
}

function ajustarSiteFixo() {
  const aplicar = () => {
    document.documentElement.style.width = "100%";
    document.documentElement.style.maxWidth = "100%";
    document.documentElement.style.overflowX = "hidden";

    document.body.style.width = "100%";
    document.body.style.maxWidth = "100%";
    document.body.style.overflowX = "hidden";

    const wrapper = document.querySelector(".site-wrapper-fixo");

    if (wrapper) {
      wrapper.style.width = "100%";
      wrapper.style.maxWidth = "100%";
      wrapper.style.overflowX = "hidden";
    }
  };

  aplicar();
  window.addEventListener("resize", aplicar);
}

/* =========================================================
   FIREBASE
========================================================= */

function carregarCategoriasFirebase() {
  const categoriasRef = collection(db, "categorias");
  const q = query(categoriasRef);

  onSnapshot(
    q,
    snapshot => {
      listaCategorias = snapshot.docs
        .map(d => normalizarCategoria({ docId: d.id, ...d.data() }))
        .filter(c => c.ativa !== false)
        .sort((a, b) => {
          const oa = Number(a.ordem) || 999;
          const ob = Number(b.ordem) || 999;

          if (oa !== ob) return oa - ob;

          return a.nome.localeCompare(b.nome);
        });

      aplicarFiltros();
    },
    () => {
      listaCategorias = [];
      aplicarFiltros();
    }
  );
}

function carregarProdutosFirebase() {
  const produtosRef = collection(db, "produtos");
  const q = query(produtosRef);

  onSnapshot(
    q,
    snapshot => {
      listaProdutos = snapshot.docs.map(d => normalizarProduto({ docId: d.id, ...d.data() })).filter(produtoEstaAtivo);

      mostrarProdutoDestaque();
      aplicarFiltros();

      if (produtoAtualPopup) {
        const atualizado = listaProdutos.find(
          p => String(p.id) === String(produtoAtualPopup.id) || String(p.docId) === String(produtoAtualPopup.docId)
        );

        if (atualizado) {
          produtoAtualPopup = atualizado;
          midiasProdutoAtual = montarMidiasProduto(atualizado);
          mostrarComentariosProduto(atualizado);
          atualizarContextoChatProduto(atualizado);
          atualizarSugestoesChatProduto(atualizado);
        } else {
          fecharPopup();
          fecharChatProduto();
          produtoAtualPopup = null;
          midiasProdutoAtual = [];
        }
      }
    },
    erro => {
      console.warn("Erro ao carregar produtos.", erro);
      alert("Erro ao carregar produtos.");
    }
  );
}

function carregarSelosConfianca() {
  const selosRef = collection(db, "selosConfianca");
  const q = query(selosRef);

  onSnapshot(
    q,
    snapshot => {
      selosConfianca = snapshot.docs.map(d => ({ docId: d.id, ...d.data() })).filter(s => s.ativo !== false);

      if (selosConfianca.length === 0) {
        selosConfianca = selosPadrao();
      }

      if (produtoAtualPopup) {
        renderizarBlocoConfianca();
      }
    },
    () => {
      selosConfianca = selosPadrao();
    }
  );
}

function produtoEstaAtivo(p) {
  return p.ativo !== false;
}

function normalizarProduto(p) {
  const plataformaNome = String(
    p.plataforma || p.plataformaNome || p.marketplace || p.loja || p.categoria || p.categoriaNome || ""
  ).trim();

  const plataformaSlug = String(
    p.plataformaSlug || p.marketplaceSlug || p.lojaSlug || p.categoriaSlug || slugify(plataformaNome)
  ).trim();

  const departamentoNome = String(
    p.departamento || p.departamentoNome || p.nicho || p.grupo || p.categoriaPrincipal || ""
  ).trim();

  const departamentoSlug = String(
    p.departamentoSlug || p.nichoSlug || p.grupoSlug || p.categoriaPrincipalSlug || slugify(departamentoNome)
  ).trim();

  const subcategoriaNome = String(
    p.subcategoria || p.subCategoria || p.subcategoriaNome || p.subCategoriaNome || p.categoriaFilha || ""
  ).trim();

  const subcategoriaSlug = String(
    p.subcategoriaSlug || p.subCategoriaSlug || p.categoriaFilhaSlug || slugify(subcategoriaNome)
  ).trim();

  const cn = String(p.categoria || p.categoriaNome || plataformaNome || "").trim();
  const cs = String(p.categoriaSlug || plataformaSlug || slugify(cn)).trim();

  return {
    ...p,
    ativo: p.ativo !== false,
    categoria: cn,
    categoriaSlug: cs,
    plataforma: plataformaNome || cn,
    plataformaSlug: plataformaSlug || cs,
    departamento: departamentoNome,
    departamentoSlug,
    subcategoria: subcategoriaNome,
    subcategoriaSlug,
    descricao: String(p.descricao || "").trim(),
    imagens: Array.isArray(p.imagens) ? p.imagens.filter(Boolean) : [],
    videos: Array.isArray(p.videos) ? p.videos.filter(Boolean) : [],
    comentarios: Array.isArray(p.comentarios) ? p.comentarios : [],
    detalhes: Array.isArray(p.detalhes) ? p.detalhes : [],
    observacoes: Array.isArray(p.observacoes) ? p.observacoes : [],
    avaliacao: Number(p.avaliacao) || 0,
    avaliacoes: Number(p.avaliacoes) || 0,
    vendidos: Number(p.vendidos) || 0,
    ordem: Number(p.ordem) || 999,
    cliquesComprar: Number(p.cliquesComprar) || 0,
    cliquesWhatsapp: Number(p.cliquesWhatsapp) || 0,
    cliquesCompartilhar: Number(p.cliquesCompartilhar) || 0,
    cliquesInstagram: Number(p.cliquesInstagram) || 0,
    cliquesTotal: Number(p.cliquesTotal) || 0,
    parcelamento: String(p.parcelamento || "").trim(),
    textoParcelamento: String(p.textoParcelamento || "").trim(),
    textoDestaque: String(p.textoDestaque || "").trim(),
    link: String(p.link || "").trim(),
    botao: String(p.botao || "Comprar agora").trim(),
    mensagemWhatsapp: String(p.mensagemWhatsapp || "").trim(),
    selo: String(p.selo || "").trim(),
    urgencia: String(p.urgencia || "").trim(),
    preco: String(p.preco || p.precoAtual || "").trim(),
    precoAntigo: String(p.precoAntigo || "").trim()
  };
}

/* =========================================================
   CATEGORIAS / HIERARQUIA
========================================================= */

function normalizarCategoria(c) {
  const n = c.nome || c.categoria || c.plataforma || "Categoria";
  const s = c.slug || c.categoriaSlug || c.plataformaSlug || slugify(n);
  const cp = corPadraoCategoria(s, n);

  return {
    docId: c.docId || "",
    nome: n,
    slug: s,
    tipo: c.tipo || "produto",
    caminhoImagens: c.caminhoImagens || `imagens/${s}/`,
    caminhoVideos: c.caminhoVideos || `videos/${s}/`,
    caminhoIcones: c.caminhoIcones || "imagens/icones/",
    extImagem: c.extImagem || ".jpg",
    extVideo: c.extVideo || ".mp4",
    extIcone: c.extIcone || ".svg",
    icone: c.icone || escolherIconeCategoria(n, s),
    corLinha: corSeguraCategoria(c.corLinha || c.corCategoria, cp),
    ordem: Number(c.ordem) || 999,
    ativa: c.ativa !== false
  };
}

function categoriasPadrao() {
  return [
    {
      nome: "Mercado Livre",
      slug: "mercado-livre",
      tipo: "produto",
      caminhoImagens: "imagens/mercado/",
      caminhoVideos: "videos/mercado/",
      caminhoIcones: "imagens/icones/",
      extImagem: ".jpg",
      extVideo: ".mp4",
      extIcone: ".svg",
      icone: ICONES.shoppingCart,
      corLinha: "#facc15",
      ordem: 1,
      ativa: true
    },
    {
      nome: "Shopee",
      slug: "shopee",
      tipo: "produto",
      caminhoImagens: "imagens/shopee/",
      caminhoVideos: "videos/shopee/",
      caminhoIcones: "imagens/icones/",
      extImagem: ".jpg",
      extVideo: ".mp4",
      extIcone: ".svg",
      icone: ICONES.shoppingCart,
      corLinha: "#f97316",
      ordem: 2,
      ativa: true
    },
    {
      nome: "Cakto",
      slug: "cakto",
      tipo: "cakto",
      caminhoImagens: "imagens/cakto/",
      caminhoVideos: "videos/cakto/",
      caminhoIcones: "imagens/icones/",
      extImagem: ".jpg",
      extVideo: ".mp4",
      extIcone: ".svg",
      icone: ICONES.package,
      corLinha: "#22c55e",
      ordem: 3,
      ativa: true
    }
  ];
}

function categoriasAtivasComFallback() {
  const mapa = new Map();

  if (listaCategorias.length > 0) {
    listaCategorias.forEach(c => mapa.set(c.slug, c));
  } else {
    categoriasPadrao().forEach(c => mapa.set(c.slug, c));
  }

  listaProdutos.forEach(p => {
    const n = p.plataforma || p.categoria || p.categoriaNome || p.categoriaSlug || "";
    const s = p.plataformaSlug || p.categoriaSlug || slugify(n);

    if (!n && !s) return;

    if (!mapa.has(s)) {
      mapa.set(
        s,
        normalizarCategoria({
          nome: n || s,
          slug: s,
          tipo: p.tipo || "produto",
          ordem: 999
        })
      );
    }
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const oa = Number(a.ordem) || 999;
    const ob = Number(b.ordem) || 999;

    if (oa !== ob) return oa - ob;

    return a.nome.localeCompare(b.nome);
  });
}

function produtoPertenceCategoria(p, c) {
  const pn = String(p.plataforma || p.categoria || p.categoriaNome || "").trim();
  const ps = String(p.plataformaSlug || p.categoriaSlug || slugify(pn)).trim();

  return ps === c.slug || slugify(pn) === c.slug || pn.toLowerCase() === c.nome.toLowerCase();
}

function produtoCombinaHierarquia(p) {
  if (plataformaAtual !== "Todos") {
    const ps = String(p.plataformaSlug || p.categoriaSlug || slugify(p.plataforma || p.categoria || "")).trim();

    if (ps !== plataformaAtual) return false;
  }

  if (departamentoAtual !== "Todos") {
    const ds = String(p.departamentoSlug || slugify(p.departamento || "")).trim();

    if (ds !== departamentoAtual) return false;
  }

  if (subcategoriaAtual !== "Todos") {
    const ss = String(p.subcategoriaSlug || slugify(p.subcategoria || "")).trim();

    if (ss !== subcategoriaAtual) return false;
  }

  return true;
}

function produtoCombinaPlataformaEscolhida(p, slug) {
  if (!slug || slug === "Todos") return true;

  const ps = String(p.plataformaSlug || p.categoriaSlug || slugify(p.plataforma || p.categoria || "")).trim();

  return ps === slug;
}

function produtoCombinaDepartamentoEscolhido(p, slug) {
  if (!slug || slug === "Todos") return true;

  const ds = String(p.departamentoSlug || slugify(p.departamento || "")).trim();

  return ds === slug;
}

function obterDepartamentosAtivos() {
  const mapa = new Map();

  listaProdutos
    .filter(produtoEstaAtivo)
    .filter(p => produtoCombinaPlataformaEscolhida(p, plataformaAtual))
    .forEach(p => {
      const nome = String(p.departamento || "").trim();
      const slug = String(p.departamentoSlug || slugify(nome)).trim();

      if (!nome || !slug) return;

      if (!mapa.has(slug)) {
        mapa.set(slug, {
          nome,
          slug,
          ordem: Number(p.ordemDepartamento || p.departamentoOrdem) || 999
        });
      }
    });

  return ordenarListaNomeOrdem(Array.from(mapa.values()));
}

function obterSubcategoriasAtivas() {
  const mapa = new Map();

  listaProdutos
    .filter(produtoEstaAtivo)
    .filter(p => produtoCombinaPlataformaEscolhida(p, plataformaAtual))
    .filter(p => produtoCombinaDepartamentoEscolhido(p, departamentoAtual))
    .forEach(p => {
      const nome = String(p.subcategoria || "").trim();
      const slug = String(p.subcategoriaSlug || slugify(nome)).trim();

      if (!nome || !slug) return;

      if (!mapa.has(slug)) {
        mapa.set(slug, {
          nome,
          slug,
          ordem: Number(p.ordemSubcategoria || p.subcategoriaOrdem) || 999
        });
      }
    });

  return ordenarListaNomeOrdem(Array.from(mapa.values()));
}

function ordenarListaNomeOrdem(lista) {
  return lista.sort((a, b) => {
    const oa = Number(a.ordem) || 999;
    const ob = Number(b.ordem) || 999;

    if (oa !== ob) return oa - ob;

    return String(a.nome || "").localeCompare(String(b.nome || ""));
  });
}

function validarFiltrosHierarquia() {
  const plataformas = categoriasAtivasComFallback();

  if (plataformaAtual !== "Todos" && !plataformas.some(p => p.slug === plataformaAtual)) {
    plataformaAtual = "Todos";
    categoriaAtual = "Todos";
    departamentoAtual = "Todos";
    subcategoriaAtual = "Todos";
  }

  const departamentos = obterDepartamentosAtivos();

  if (departamentoAtual !== "Todos" && !departamentos.some(d => d.slug === departamentoAtual)) {
    departamentoAtual = "Todos";
    subcategoriaAtual = "Todos";
  }

  const subcategorias = obterSubcategoriasAtivas();

  if (subcategoriaAtual !== "Todos" && !subcategorias.some(s => s.slug === subcategoriaAtual)) {
    subcategoriaAtual = "Todos";
  }
}

/* =========================================================
   BUSCA / FILTROS
========================================================= */

function criarControlesBuscaInteligente() {
  const pesquisa = document.getElementById("pesquisa");

  if (!pesquisa) return;

  const antigoPai = pesquisa.parentElement;

  limparIconesBuscaSoltos(pesquisa);

  let painel = document.getElementById("painelBuscaInteligente");

  if (!painel) {
    painel = document.createElement("div");
    painel.id = "painelBuscaInteligente";
    painel.className = "busca-inteligente-painel";

    painel.innerHTML = `
      <div class="busca-inteligente-topo">
        <div>
          <strong>Encontre sua oferta</strong>
          <span>Pesquise por nome, plataforma, departamento, subcategoria, preço ou descrição.</span>
        </div>
      </div>

      <div class="busca-linha-superior">
        <div class="campo-pesquisa-organizado" id="campoPesquisaOrganizado">
          <img src="${ICONES.search}" alt="Pesquisar">
        </div>

        <select id="ordenarProdutos" class="ordenar-produtos-js">
          <option value="relevancia">Ordenar por relevância</option>
          <option value="menor-preco">Menor preço</option>
          <option value="maior-preco">Maior preço</option>
          <option value="mais-avaliados">Mais avaliados</option>
          <option value="mais-vendidos">Mais vendidos</option>
          <option value="novidades">Novidades</option>
        </select>
      </div>

      <div class="grupo-filtros-rapidos">
        <div class="titulo-filtro-organizado">Filtros rápidos</div>

        <div id="filtrosRapidosBusca" class="filtros-rapidos-busca">
          <button type="button" class="ativo" data-filtro-rapido="todos">Todos</button>
          <button type="button" data-filtro-rapido="mais-vendido">Mais vendidos</button>
          <button type="button" data-filtro-rapido="novidade">Novidades</button>
          <button type="button" data-filtro-rapido="promocao">Promoções</button>
          <button type="button" data-filtro-rapido="recomendado">Recomendados</button>
        </div>
      </div>
    `;

    if (antigoPai && antigoPai.parentElement) {
      antigoPai.parentElement.insertBefore(painel, antigoPai);
    } else {
      pesquisa.insertAdjacentElement("beforebegin", painel);
    }
  }

  const campoPesquisa = document.getElementById("campoPesquisaOrganizado");

  if (campoPesquisa && pesquisa.parentElement !== campoPesquisa) {
    campoPesquisa.appendChild(pesquisa);
  }

  pesquisa.classList.add("pesquisa-organizada-js");

  if (antigoPai && antigoPai !== document.body) {
    antigoPai.classList.add("busca-antiga-limpa");
  }

  const ordenar = document.getElementById("ordenarProdutos");

  if (ordenar && ordenar.dataset.listenerAtivo !== "sim") {
    ordenar.dataset.listenerAtivo = "sim";

    ordenar.addEventListener("change", () => {
      ordenarAtual = ordenar.value || "relevancia";
      resetarPaginas();
      aplicarFiltros();
    });
  }

  document.querySelectorAll("#filtrosRapidosBusca button").forEach(btn => {
    if (btn.dataset.listenerAtivo === "sim") return;

    btn.dataset.listenerAtivo = "sim";

    btn.addEventListener("click", () => {
      filtrarRapido(btn.dataset.filtroRapido || "todos");
    });
  });
}

function limparIconesBuscaSoltos(pesquisa) {
  const pai = pesquisa?.parentElement;

  if (!pai) return;

  Array.from(pai.children).forEach(el => {
    if (el === pesquisa) return;

    const tag = el.tagName?.toLowerCase();
    const classe = String(el.className || "").toLowerCase();

    if (
      tag === "svg" ||
      tag === "i" ||
      (tag === "img" &&
        (classe.includes("search") || classe.includes("busca") || classe.includes("lupa") || classe.includes("icone"))) ||
      classe.includes("search") ||
      classe.includes("busca") ||
      classe.includes("lupa")
    ) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  });
}

function filtrarRapido(tipo) {
  filtroRapidoAtual = tipo || "todos";

  document.querySelectorAll("#filtrosRapidosBusca button").forEach(btn => {
    btn.classList.toggle("ativo", btn.dataset.filtroRapido === filtroRapidoAtual);
  });

  resetarPaginas();
  aplicarFiltros();
}

function aplicarFiltros() {
  const pesquisa = document.getElementById("pesquisa");
  const termo = pesquisa ? pesquisa.value : "";

  validarFiltrosHierarquia();

  let filtrados = listaProdutos.filter(
    p => produtoEstaAtivo(p) && produtoCombinaPesquisa(p, termo) && produtoCombinaFiltroRapido(p) && produtoCombinaHierarquia(p)
  );

  filtrados = aplicarOrdenacaoProdutos(filtrados);

  mostrarProdutosPorCategoria(filtrados);
}

function filtrarCategoria(cat) {
  filtrarPlataforma(cat);
}

function filtrarPlataforma(slug) {
  plataformaAtual = slug || "Todos";
  categoriaAtual = plataformaAtual;
  departamentoAtual = "Todos";
  subcategoriaAtual = "Todos";
  resetarPaginas();
  aplicarFiltros();
}

function filtrarDepartamento(slug) {
  departamentoAtual = slug || "Todos";
  subcategoriaAtual = "Todos";
  resetarPaginas();
  aplicarFiltros();
}

function filtrarSubcategoria(slug) {
  subcategoriaAtual = slug || "Todos";
  resetarPaginas();
  aplicarFiltros();
}

function limparFiltrosHierarquia() {
  plataformaAtual = "Todos";
  categoriaAtual = "Todos";
  departamentoAtual = "Todos";
  subcategoriaAtual = "Todos";
  resetarPaginas();
  aplicarFiltros();
}

function produtoCombinaPesquisa(p, termo) {
  const tn = normalizarTexto(termo);

  if (!tn) return true;

  const texto = textoBuscaProduto(p);

  const palavras = tn
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);

  return palavras.every(w => texto.includes(w));
}

function produtoCombinaFiltroRapido(p) {
  const t = textoBuscaProduto(p);

  if (filtroRapidoAtual === "todos") return true;

  if (filtroRapidoAtual === "mais-vendido") {
    return t.includes("mais vendido") || t.includes("vendidos") || Number(p.vendidos) > 0;
  }

  if (filtroRapidoAtual === "novidade") {
    return t.includes("novidade") || t.includes("lancamento") || t.includes("lançamento");
  }

  if (filtroRapidoAtual === "promocao") {
    return t.includes("promocao") || t.includes("promoção") || t.includes("oferta") || Boolean(p.precoAntigo) || Boolean(p.destaque);
  }

  if (filtroRapidoAtual === "recomendado") {
    return Boolean(p.recomendado) || t.includes("recomendado");
  }

  return true;
}

function aplicarOrdenacaoProdutos(produtos) {
  const l = produtos.slice();

  if (ordenarAtual === "menor-preco") {
    return l.sort((a, b) => {
      const pa = precoProduto(a);
      const pb = precoProduto(b);

      if (pa === 0 && pb !== 0) return 1;
      if (pb === 0 && pa !== 0) return -1;

      return pa - pb;
    });
  }

  if (ordenarAtual === "maior-preco") {
    return l.sort((a, b) => precoProduto(b) - precoProduto(a));
  }

  if (ordenarAtual === "mais-avaliados") {
    return l.sort((a, b) => {
      const nb = Number(b.avaliacao) || 0;
      const na = Number(a.avaliacao) || 0;

      if (nb !== na) return nb - na;

      return (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0);
    });
  }

  if (ordenarAtual === "mais-vendidos") {
    return l.sort((a, b) => {
      const vb = Number(b.vendidos) || 0;
      const va = Number(a.vendidos) || 0;

      if (vb !== va) return vb - va;

      return (Number(b.cliquesTotal) || 0) - (Number(a.cliquesTotal) || 0);
    });
  }

  if (ordenarAtual === "novidades") {
    return l.sort((a, b) => {
      const db = dataProduto(b);
      const da = dataProduto(a);

      if (db !== da) return db - da;

      return String(b.nome || "").localeCompare(String(a.nome || ""));
    });
  }

  return l.sort((a, b) => {
    if ((a.destaque ? 1 : 0) !== (b.destaque ? 1 : 0)) {
      return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0);
    }

    const oa = Number(a.ordem) || 999;
    const ob = Number(b.ordem) || 999;

    if (oa !== ob) return oa - ob;

    if ((a.recomendado ? 1 : 0) !== (b.recomendado ? 1 : 0)) {
      return (b.recomendado ? 1 : 0) - (a.recomendado ? 1 : 0);
    }

    return String(a.nome || "").localeCompare(String(b.nome || ""));
  });
}

/* =========================================================
   RENDERIZAÇÃO DA LOJA
========================================================= */

function garantirEstruturaDinamica() {
  if (document.getElementById("categorias-container")) return;

  const mercado = document.getElementById("produtos-mercado");
  const cakto = document.getElementById("produtos-cakto");

  if (mercado || cakto) {
    const ps = mercado?.closest("section") || cakto?.closest("section");

    if (ps && ps.parentElement) {
      const c = document.createElement("div");
      c.id = "categorias-container";
      ps.parentElement.insertBefore(c, ps);

      if (mercado?.closest("section")) mercado.closest("section").style.display = "none";
      if (cakto?.closest("section")) cakto.closest("section").style.display = "none";
    }
  }
}

function mostrarProdutosPorCategoria(produtos) {
  const cats = categoriasAtivasComFallback();

  renderizarBotoesFiltro(cats);

  let mostrar = cats;

  if (plataformaAtual !== "Todos") {
    mostrar = cats.filter(c => c.slug === plataformaAtual);
  }

  renderizarSecoesCategorias(mostrar);

  const container = document.getElementById("categorias-container");

  if (mostrar.length === 0 && container) {
    container.innerHTML = `<div class="categoria-loading">Categoria não encontrada.</div>`;
    return;
  }

  mostrar.forEach(cat => {
    renderizarProdutosComPaginacao(produtos.filter(p => produtoPertenceCategoria(p, cat)), cat);
  });
}

function renderizarBotoesFiltro(cats) {
  const area = document.getElementById("botoes-filtro");

  if (!area) return;

  area.classList.add("filtros-categoria-loja", "filtros-hierarquia-loja");

  const departamentos = obterDepartamentosAtivos();
  const subcategorias = obterSubcategoriasAtivas();

  area.innerHTML = `
    <div class="titulo-categorias-organizado">Categorias inteligentes</div>

    <div class="filtro-hierarquia-grupo">
      <div class="filtro-hierarquia-titulo">Plataforma</div>
      <div class="botoes-categoria-organizado botoes-hierarquia">
        ${montarBotoesFiltroHierarquia(cats, plataformaAtual, "plataforma", "filtrarPlataforma", "Todas")}
      </div>
    </div>

    <div class="filtro-hierarquia-grupo">
      <div class="filtro-hierarquia-titulo">Departamento</div>
      <div class="botoes-categoria-organizado botoes-hierarquia">
        ${montarBotoesFiltroHierarquia(departamentos, departamentoAtual, "departamento", "filtrarDepartamento", "Todos")}
      </div>
    </div>

    <div class="filtro-hierarquia-grupo">
      <div class="filtro-hierarquia-titulo">Subcategoria</div>
      <div class="botoes-categoria-organizado botoes-hierarquia">
        ${montarBotoesFiltroHierarquia(subcategorias, subcategoriaAtual, "subcategoria", "filtrarSubcategoria", "Todas")}
      </div>
    </div>

    <div class="caminho-filtro-loja">
      ${montarTextoCaminhoFiltro(cats, departamentos, subcategorias)}
      <button type="button" onclick="limparFiltrosHierarquia()">Limpar filtros</button>
    </div>
  `;
}

function montarBotoesFiltroHierarquia(lista, atual, tipo, funcao, todosTexto) {
  let html = `
    <button type="button" onclick="${funcao}('Todos')" class="${atual === "Todos" ? "ativo" : ""}" data-${tipo}="Todos">
      ${escaparHTML(todosTexto)}
    </button>
  `;

  if (!lista.length) {
    html += `<button type="button" disabled class="desativado">Nenhuma opção</button>`;
    return html;
  }

  lista.forEach(item => {
    html += `
      <button type="button" onclick="${funcao}('${escaparJS(item.slug)}')" class="${atual === item.slug ? "ativo" : ""}" data-${tipo}="${escaparHTML(item.slug)}">
        ${escaparHTML(item.nome)}
      </button>
    `;
  });

  return html;
}

function montarTextoCaminhoFiltro(cats, departamentos, subcategorias) {
  const plataforma = plataformaAtual === "Todos" ? "Todas as plataformas" : nomePorSlug(cats, plataformaAtual);
  const departamento = departamentoAtual === "Todos" ? "Todos os departamentos" : nomePorSlug(departamentos, departamentoAtual);
  const subcategoria = subcategoriaAtual === "Todos" ? "Todas as subcategorias" : nomePorSlug(subcategorias, subcategoriaAtual);

  return `Mostrando: <strong>${escaparHTML(plataforma)}</strong> <span>›</span> <strong>${escaparHTML(departamento)}</strong> <span>›</span> <strong>${escaparHTML(subcategoria)}</strong>`;
}

function nomePorSlug(lista, slug) {
  const item = lista.find(i => i.slug === slug);

  return item?.nome || slug || "Todos";
}

function renderizarSecoesCategorias(cats) {
  const container = document.getElementById("categorias-container");

  if (!container) return;

  if (cats.length === 0) {
    container.innerHTML = `<div class="categoria-loading">Nenhuma categoria encontrada.</div>`;
    return;
  }

  container.innerHTML = cats
    .map(
      c => `
      <section id="secao-${escaparHTML(c.slug)}" class="categoria-loja" data-categoria="${escaparHTML(c.slug)}" style="--cor-categoria:${corSeguraCategoria(c.corLinha, corPadraoCategoria(c.slug, c.nome))}">
        <h2 class="titulo-categoria-dinamica" style="--cor-categoria:${corSeguraCategoria(c.corLinha, corPadraoCategoria(c.slug, c.nome))}">
          <img src="${c.icone || ICONES.package}" alt="${escaparHTML(c.nome)}" onerror="this.onerror=null;this.src='${ICONES.package}'">
          ${escaparHTML(c.nome)}
        </h2>

        <div id="produtos-${escaparHTML(c.slug)}" class="grid"></div>
        <div id="paginacao-${escaparHTML(c.slug)}" class="paginacao-loja"></div>
      </section>
    `
    )
    .join("");
}

function renderizarProdutosComPaginacao(prods, cat) {
  const grid = document.getElementById(`produtos-${cat.slug}`);
  const secao = document.getElementById(`secao-${cat.slug}`);
  const pag = document.getElementById(`paginacao-${cat.slug}`);

  if (!grid || !secao) return;

  if (prods.length === 0) {
    const temFiltroAtivo = plataformaAtual !== "Todos" || departamentoAtual !== "Todos" || subcategoriaAtual !== "Todos";

    secao.style.display = temFiltroAtivo ? "block" : "none";
    grid.innerHTML = temFiltroAtivo ? `<div class="categoria-sem-produtos">Nenhum produto encontrado.</div>` : "";

    if (pag) pag.innerHTML = "";

    return;
  }

  secao.style.display = "block";

  const totalPaginas = Math.ceil(prods.length / PRODUTOS_POR_PAGINA);
  let paginaAtual = pegarPaginaAtual(cat.slug);

  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
  if (paginaAtual < 1) paginaAtual = 1;

  definirPaginaAtual(cat.slug, paginaAtual);

  const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;

  grid.innerHTML = prods.slice(inicio, inicio + PRODUTOS_POR_PAGINA).map(criarCardProduto).join("");

  renderizarPaginacao(cat.slug, prods.length, pag);
}

function criarCardProduto(p) {
  const departamento = p.departamento ? `<span class="produto-mini-categoria">${escaparHTML(p.departamento)}</span>` : "";

  return `
    <div class="produto" onclick="abrirPopupProduto('${escaparJS(p.id || p.docId)}')">
      ${p.urgencia ? `<div class="urgencia">${escaparHTML(p.urgencia)}</div>` : ""}

      <div class="imagem-area">
        <img src="${p.imagens?.[0] || IMAGEM_FALLBACK}" alt="${escaparHTML(p.nome || "Produto")}" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'">
      </div>

      ${departamento}
      <h2>${escaparHTML(p.nome || "")}</h2>

      <div class="avaliacao">
        ${gerarEstrelas(Number(p.avaliacao) || 0)}
        <span>${Number(p.avaliacao) ? Number(p.avaliacao).toFixed(1) : "5.0"}</span>
      </div>

      <strong>${escaparHTML(p.preco || "")}</strong>

      ${p.parcelamento ? `<span class="produto-parcelamento">${escaparHTML(p.parcelamento)}</span>` : ""}
    </div>
  `;
}

function resetarPaginas() {
  paginasCategorias = {};
}

function pegarPaginaAtual(slug) {
  return paginasCategorias[slug] || 1;
}

function definirPaginaAtual(slug, pagina) {
  paginasCategorias[slug] = pagina;
}

function trocarPaginaProdutos(slug, pagina) {
  definirPaginaAtual(slug, pagina);
  aplicarFiltros();

  const secao = document.getElementById(`secao-${slug}`);

  if (secao) {
    setTimeout(() => {
      secao.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
}

function gerarListaPaginas(total, atual) {
  const pags = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pags.push(i);
    return pags;
  }

  pags.push(1);

  if (atual > 3) pags.push("...");

  const ini = Math.max(2, atual - 1);
  const fim = Math.min(total - 1, atual + 1);

  for (let i = ini; i <= fim; i++) pags.push(i);

  if (atual < total - 2) pags.push("...");

  pags.push(total);

  return pags;
}

function renderizarPaginacao(slug, total, el) {
  if (!el) return;

  const totalPaginas = Math.ceil(total / PRODUTOS_POR_PAGINA);
  const paginaAtual = pegarPaginaAtual(slug);

  if (totalPaginas <= 1) {
    el.innerHTML = "";
    return;
  }

  const pags = gerarListaPaginas(totalPaginas, paginaAtual);

  let html = `
    <button onclick="trocarPaginaProdutos('${slug}', ${Math.max(1, paginaAtual - 1)})" ${paginaAtual === 1 ? "disabled" : ""} title="Anterior">
      <img src="${ICONES.chevronLeft}" alt="Anterior">
    </button>
  `;

  pags.forEach(p => {
    if (p === "...") {
      html += `<span class="paginacao-reticencias">...</span>`;
    } else {
      html += `<button onclick="trocarPaginaProdutos('${slug}', ${p})" class="${p === paginaAtual ? "ativo" : ""}">${p}</button>`;
    }
  });

  html += `
    <button onclick="trocarPaginaProdutos('${slug}', ${Math.min(totalPaginas, paginaAtual + 1)})" ${paginaAtual === totalPaginas ? "disabled" : ""} title="Próxima">
      <img src="${ICONES.chevronRight}" alt="Próxima">
    </button>
    <div class="paginacao-info">Página ${paginaAtual} de ${totalPaginas} • ${total} produto(s)</div>
  `;

  el.innerHTML = html;
}

function mostrarProdutoDestaque() {
  const destaque = listaProdutos.find(p => produtoEstaAtivo(p) && p.destaque === true);
  const area = document.getElementById("produto-destaque");

  if (!area) return;

  area.innerHTML = destaque ? criarCardProduto(destaque) : "";

  atualizarAreaDestaque();
}

function atualizarAreaDestaque() {
  const area = document.getElementById("area-oferta-dia");
  const produtoDestaque = document.getElementById("produto-destaque");

  if (!area || !produtoDestaque) return;

  const tem = Boolean(produtoDestaque.querySelector(".produto"));

  if (tem) {
    area.hidden = false;
    area.classList.add("tem-destaque");
  } else {
    area.classList.remove("tem-destaque");
    area.hidden = true;
  }
}

/* =========================================================
   POPUP DO PRODUTO
========================================================= */

function abrirPopupProduto(id) {
  const produto = listaProdutos.find(p => String(p.id) === String(id) || String(p.docId) === String(id));

  if (!produto) {
    alert("Produto não encontrado.");
    return;
  }

  produtoAtualPopup = produto;
  midiasProdutoAtual = montarMidiasProduto(produto);

  renderizarMidiaPopup(0);
  renderizarMiniaturas();

  definirTexto("popup-nome", produto.nome || "");
  definirTexto("popup-preco", produto.preco || "");
  mostrarOuOcultar("popup-preco", Boolean(produto.preco));

  const antigoEl = document.getElementById("popup-preco-antigo");

  if (antigoEl) {
    antigoEl.textContent = produto.precoAntigo || "";
    antigoEl.style.display = produto.precoAntigo ? "block" : "none";
  }

  const parcelamentoEl = document.getElementById("popup-parcelamento");

  if (parcelamentoEl) {
    if (produto.parcelamento) {
      const extra = produto.textoParcelamento
        ? `<span class="texto-parcelamento-extra">${escaparHTML(produto.textoParcelamento)}</span>`
        : "";

      parcelamentoEl.innerHTML = `
        <img src="${ICONES.creditCard}" alt="Cartão" class="icone-parcelamento-azul">
        <span class="texto-parcelamento-popup">
          <span>Cartão ${escaparHTML(produto.parcelamento)}</span>
          ${extra}
        </span>
      `;

      parcelamentoEl.style.display = "flex";
    } else {
      parcelamentoEl.textContent = "";
      parcelamentoEl.style.display = "none";
    }
  }

  const destaqueEl = document.getElementById("popup-destaque-parcelamento");

  if (destaqueEl) {
    destaqueEl.textContent = produto.textoDestaque || "";
    destaqueEl.style.display = produto.textoDestaque ? "block" : "none";
  }

  const descEl = document.getElementById("popup-descricao");

  if (descEl) {
    descEl.textContent = produto.descricao || "";
    descEl.style.display = produto.descricao ? "block" : "none";
    descEl.classList.toggle("popup-descricao-caixa", Boolean(produto.descricao));
  }

  const catEl = document.getElementById("popup-categoria");

  if (catEl) {
    const partes = [produto.plataforma, produto.departamento, produto.subcategoria].filter(Boolean);
    catEl.textContent = partes.join(" › ");
    catEl.style.display = partes.length ? "block" : "none";
  }

  atualizarResumoAvaliacao(produto);
  renderizarBlocoConfianca();
  renderizarDetalhesProduto(produto);
  mostrarComentariosProduto(produto);
  atualizarContextoChatProduto(produto);
  atualizarSugestoesChatProduto(produto);

  window.linkAtualProduto = produto.link || "";

  const btnComprar = document.getElementById("popup-comprar");

  if (btnComprar) {
    btnComprar.href = produto.link || "#";
    btnComprar.innerHTML = `<img src="${ICONES.cart}" alt="Comprar" class="icone-carrinho"> ${escaparHTML(produto.botao || "Comprar agora")}`;

    btnComprar.onclick = event => {
      event.preventDefault();
      registrarCliqueProduto("comprar", produto);

      if (produto.link) {
        window.open(produto.link, "_blank", "noopener");
      }
    };
  }

  const btnChat = document.getElementById("popup-chatbot") || document.getElementById("popup-whatsapp");

  if (btnChat) {
    btnChat.onclick = () => abrirChatProduto();
  }

  const box = document.getElementById("popup-comentarios-box");
  const btn = document.getElementById("btn-comentarios");

  if (box && btn) {
    box.classList.remove("ativo");
    btn.innerHTML = `<img src="${ICONES.messageSquare}" alt="Comentários" class="icone-js ciano"> Ver comentários`;
  }

  const popup = document.getElementById("popup-produto");

  if (popup) popup.classList.add("ativo");

  const sy = window.scrollY || 0;

  document.body.dataset.scrollY = String(sy);
  document.body.classList.add("popup-aberto");
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
  document.body.style.top = `-${sy}px`;
}

function fecharPopup() {
  const sy = Number(document.body.dataset.scrollY || 0);
  const popup = document.getElementById("popup-produto");

  if (popup) popup.classList.remove("ativo");

  const midia = document.querySelector("#popup-imagem");

  if (midia && midia.tagName === "VIDEO") {
    midia.pause();
  }

  document.body.classList.remove("popup-aberto");
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.top = "";

  window.scrollTo(0, sy);
}

function renderizarDetalhesProduto(produto) {
  const detalhesDiv = document.getElementById("popup-detalhes");

  if (detalhesDiv) {
    const detalhes = Array.isArray(produto.detalhes) ? produto.detalhes : [];

    if (detalhes.length > 0) {
      detalhesDiv.innerHTML = `
        <h3 class="titulo-secao-popup">
          <img src="${ICONES.clipboardList}" alt="Características" class="icone-titulo-azul">
          <span>Características do Produto</span>
        </h3>
        ${detalhes
          .map(
            d => `
          <p class="linha-icone-js">
            <img src="${ICONES.circleCheck}" alt="Detalhe" class="icone-js pequeno verde">
            <span>${escaparHTML(d)}</span>
          </p>
        `
          )
          .join("")}
      `;
      detalhesDiv.style.display = "block";
    } else {
      detalhesDiv.innerHTML = "";
      detalhesDiv.style.display = "none";
    }
  }

  const obsEl = document.getElementById("popup-observacoes");

  if (obsEl) {
    const observacoes = Array.isArray(produto.observacoes) ? produto.observacoes : [];

    if (observacoes.length > 0) {
      obsEl.innerHTML = observacoes.map(o => `<p>${escaparHTML(o)}</p>`).join("");
      obsEl.style.display = "block";
    } else {
      obsEl.innerHTML = "";
      obsEl.style.display = "none";
    }
  }
}

function definirTexto(id, texto) {
  const el = document.getElementById(id);

  if (el) el.textContent = texto;
}

function mostrarOuOcultar(id, mostrar) {
  const el = document.getElementById(id);

  if (el) el.style.display = mostrar ? "block" : "none";
}

/* =========================================================
   MÍDIAS
========================================================= */

function montarMidiasProduto(p) {
  return [...(p.imagens || []).map(u => ({ tipo: "imagem", url: u })), ...(p.videos || []).map(u => ({ tipo: "video", url: u }))];
}

function renderizarMidiaPopup(i) {
  const area = document.querySelector(".popup-imagem-area");

  if (!area) return;

  const total = midiasProdutoAtual.length;
  const midia = midiasProdutoAtual[i];

  if (!midia) {
    area.innerHTML = `
      <div id="popup-imagem" data-imagem-atual="0" style="width:100%;height:320px;display:flex;align-items:center;justify-content:center;color:#94a3b8;background:#020617;">
        Sem mídia
      </div>
      <span class="contador-imagem">0/0</span>
    `;
    return;
  }

  area.innerHTML =
    midia.tipo === "video"
      ? `
      <video id="popup-imagem" src="${midia.url}" data-imagem-atual="${i}" controls playsinline style="width:100%;height:100%;max-height:460px;object-fit:contain;background:#020617;"></video>
      <span class="contador-imagem">${i + 1}/${total}</span>
    `
      : `
      <img id="popup-imagem" src="${midia.url}" alt="" data-imagem-atual="${i}" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'">
      <span class="contador-imagem">${i + 1}/${total}</span>
    `;
}

function renderizarMiniaturas() {
  const tc = document.getElementById("popup-thumbs");

  if (!tc) return;

  tc.innerHTML = midiasProdutoAtual
    .map((m, i) =>
      m.tipo === "video"
        ? `
        <button class="popup-thumb ${i === 0 ? "ativa" : ""}" onclick="atualizarImagem(${i})" style="width:60px;height:60px;border-radius:8px;border:2px solid ${
            i === 0 ? "#22c55e" : "transparent"
          };background:#020617;color:white;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Vídeo">
          <img src="${ICONES.play}" alt="Vídeo" class="video-thumb-icon">
        </button>
      `
        : `
        <img src="${m.url}" class="popup-thumb ${i === 0 ? "ativa" : ""}" onclick="atualizarImagem(${i})" alt="Miniatura" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'">
      `
    )
    .join("");
}

function atualizarImagem(i) {
  if (!midiasProdutoAtual.length) return;

  const midiaAtual = document.querySelector("#popup-imagem");

  if (midiaAtual && midiaAtual.tagName === "VIDEO") {
    midiaAtual.pause();
  }

  renderizarMidiaPopup(i);

  document.querySelectorAll(".popup-thumb").forEach((t, j) => {
    t.classList.toggle("ativa", j === i);

    if (t.tagName === "BUTTON") {
      t.style.borderColor = j === i ? "#22c55e" : "transparent";
    }
  });
}

function ativarSwipeImagem() {
  const area = document.querySelector(".popup-imagem-area");

  if (!area) return;

  let inicioX = 0;

  area.addEventListener(
    "touchstart",
    e => {
      if (e.touches && e.touches.length === 1) {
        inicioX = e.touches[0].clientX;
      }
    },
    { passive: true }
  );

  area.addEventListener(
    "touchend",
    e => {
      const fimX = e.changedTouches[0].clientX;

      if (fimX < inicioX - 50) proximaImagemPopup();
      if (fimX > inicioX + 50) imagemAnteriorPopup();
    },
    { passive: true }
  );
}

function proximaImagemPopup() {
  if (!midiasProdutoAtual.length) return;

  const el = document.getElementById("popup-imagem");
  let atual = Number(el?.getAttribute("data-imagem-atual") || 0) + 1;

  if (atual >= midiasProdutoAtual.length) atual = 0;

  atualizarImagem(atual);
}

function imagemAnteriorPopup() {
  if (!midiasProdutoAtual.length) return;

  const el = document.getElementById("popup-imagem");
  let atual = Number(el?.getAttribute("data-imagem-atual") || 0) - 1;

  if (atual < 0) atual = midiasProdutoAtual.length - 1;

  atualizarImagem(atual);
}

/* =========================================================
   COMENTÁRIOS / AVALIAÇÕES
========================================================= */

function mostrarComentariosProduto(produto) {
  const lista = document.getElementById("popup-lista-comentarios");
  const comentarios = Array.isArray(produto.comentarios) ? produto.comentarios : [];

  if (lista) {
    if (comentarios.length === 0) {
      lista.innerHTML = `<p class="sem-comentarios">Nenhum comentário ainda.</p>`;
    } else {
      lista.innerHTML = comentarios
        .map(c => {
          const nota = Math.max(1, Math.min(5, Number(c.nota) || 5));

          return `
            <div class="comentario-card">
              <strong>${escaparHTML(c.nome || "Cliente")}</strong>
              <div>${gerarEstrelas(nota)}</div>
              <p>${escaparHTML(c.texto || "")}</p>
            </div>
          `;
        })
        .join("");
    }
  }

  atualizarResumoAvaliacao(produto);
  atualizarBarrasAvaliacoes(calcularPorcentagensAvaliacoes(produto, comentarios));
}

function atualizarResumoAvaliacao(produto) {
  const media = Number(produto.avaliacao) || 5;
  const total = Number(produto.avaliacoes) || 0;

  document.querySelectorAll("#popup-avaliacao-media, #popup-avaliacao-media-resumo").forEach(el => {
    el.textContent = media.toFixed(1);
  });

  document.querySelectorAll("#popup-avaliacao-total, #popup-avaliacao-total-resumo").forEach(el => {
    el.textContent = `(${total} avaliações)`;
  });

  const estrelasEl = document.getElementById("popup-estrelas");

  if (estrelasEl) {
    estrelasEl.innerHTML = gerarEstrelas(media);
  }
}

function calcularPorcentagensAvaliacoes(produto, comentarios) {
  const porcentagens = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  if (comentarios.length > 0) {
    const contagem = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    comentarios.forEach(c => {
      const nota = Math.max(1, Math.min(5, Number(c.nota) || 5));
      contagem[nota]++;
    });

    const total = comentarios.length || 1;

    for (let i = 1; i <= 5; i++) {
      porcentagens[i] = Math.round((contagem[i] / total) * 100);
    }

    return porcentagens;
  }

  const media = Number(produto.avaliacao) || 5;

  if (media >= 4.8) return { 5: 82, 4: 14, 3: 3, 2: 1, 1: 0 };
  if (media >= 4.5) return { 5: 72, 4: 20, 3: 6, 2: 2, 1: 0 };
  if (media >= 4.0) return { 5: 60, 4: 25, 3: 10, 2: 4, 1: 1 };
  if (media >= 3.5) return { 5: 45, 4: 28, 3: 17, 2: 7, 1: 3 };

  return { 5: 35, 4: 25, 3: 20, 2: 12, 1: 8 };
}

function atualizarBarrasAvaliacoes(porcentagens) {
  for (let i = 5; i >= 1; i--) {
    const barra = document.getElementById(`barra-${i}`);

    if (!barra) continue;

    const valor = Math.max(0, Math.min(100, Number(porcentagens[i]) || 0));

    barra.style.width = `${valor}%`;
    barra.style.height = "100%";
    barra.style.borderRadius = "999px";
    barra.style.background = "linear-gradient(90deg,#facc15,#f97316)";
  }
}

function toggleComentarios() {
  const box = document.getElementById("popup-comentarios-box");
  const btn = document.getElementById("btn-comentarios");

  if (!box || !btn) return;

  const aberto = box.classList.contains("ativo");

  box.classList.toggle("ativo", !aberto);

  btn.innerHTML = aberto
    ? `<img src="${ICONES.messageSquare}" alt="Comentários" class="icone-js ciano"> Ver comentários`
    : `<img src="${ICONES.chevronDown}" alt="Ocultar" class="icone-js ciano"> Ocultar comentários`;
}

function prepararFormularioComentario() {
  const form = document.getElementById("form-comentario");

  if (!form || form.dataset.listenerAtivo === "sim") return;

  form.dataset.listenerAtivo = "sim";

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (comentarioEnviando) return;

    comentarioEnviando = true;

    if (!produtoAtualPopup) {
      alert("Abra um produto.");
      comentarioEnviando = false;
      return;
    }

    const btn = form.querySelector("button");

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<img src="${ICONES.send}" alt="Enviando" class="icone-js pequeno ciano"> Enviando...`;
    }

    const fd = new FormData(form);
    const nome = String(fd.get("name") || fd.get("nome") || "").trim();
    const texto = String(fd.get("message") || fd.get("texto") || "").trim();

    if (!nome || !texto) {
      alert("Preencha todos os campos.");
      finalizarEnvioComentario(btn);
      return;
    }

    try {
      await updateDoc(doc(db, "produtos", produtoAtualPopup.docId), {
        comentarios: arrayUnion({
          id: Date.now() + Math.floor(Math.random() * 999),
          nome,
          email: "zyqenstore@gmail.com",
          texto,
          nota: Number(fd.get("nota")) || 5,
          origem: "site",
          criadoEm: new Date().toISOString()
        })
      });

      form.reset();
      abrirPopupSucessoComentario();
    } catch (erro) {
      console.warn("Erro ao enviar comentário.", erro);
      alert("Erro ao enviar.");
    }

    finalizarEnvioComentario(btn);
  });
}

function finalizarEnvioComentario(btn) {
  comentarioEnviando = false;

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<img src="${ICONES.send}" alt="Enviar" class="icone-js pequeno ciano"> Enviar comentário`;
  }
}

function abrirPopupSucessoComentario() {
  const popup = document.getElementById("popup-sucesso-comentario");

  if (popup) popup.classList.add("ativo");
}

function fecharPopupSucessoComentario() {
  const popup = document.getElementById("popup-sucesso-comentario");

  if (popup) popup.classList.remove("ativo");
}

/* =========================================================
   CLIQUES / COMPARTILHAR
========================================================= */

async function registrarCliqueProduto(tipo, produto = produtoAtualPopup) {
  if (!produto || !produto.docId) return;

  const campoPorTipo = {
    comprar: "cliquesComprar",
    whatsapp: "cliquesWhatsapp",
    compartilhar: "cliquesCompartilhar",
    instagram: "cliquesInstagram"
  };

  const campo = campoPorTipo[tipo];

  if (!campo) return;

  const chave = `${produto.docId}-${campo}`;

  if (cliquesEmAndamento.has(chave)) return;

  cliquesEmAndamento.add(chave);

  try {
    await updateDoc(doc(db, "produtos", produto.docId), {
      [campo]: increment(1),
      cliquesTotal: increment(1)
    });
  } catch (erro) {
    console.warn("Erro ao registrar clique.", erro);
  } finally {
    setTimeout(() => cliquesEmAndamento.delete(chave), 650);
  }
}

function compartilharProduto() {
  const produto = produtoAtualPopup;

  if (!produto) return;

  registrarCliqueProduto("compartilhar", produto);

  const titulo = produto.nome || "Produto Zyqen Store";
  const url = produto.link || window.location.href;
  const texto = `${titulo} - ${produto.preco || "Oferta"}`;

  if (navigator.share) {
    navigator.share({ title: titulo, text: texto, url }).catch(() => {});
    return;
  }

  navigator.clipboard
    ?.writeText(url)
    .then(() => alert("Link copiado!"))
    .catch(() => {
      window.prompt("Copie o link:", url);
    });
}

function prepararCliquesInstagram() {
  document.querySelectorAll('a[href*="instagram"], a[href*="@zyqen"]').forEach(link => {
    if (link.dataset.listenerCliqueInstagram === "sim") return;

    link.dataset.listenerCliqueInstagram = "sim";

    link.addEventListener("click", () => {
      if (produtoAtualPopup) registrarCliqueProduto("instagram", produtoAtualPopup);
    });
  });
}

/* =========================================================
   UTILITÁRIOS
========================================================= */

function gerarEstrelas(avaliacao) {
  let html = `<span class="estrelas-icone">`;
  const nota = Math.floor(Number(avaliacao) || 0);

  for (let i = 0; i < 5; i++) {
    const cheia = i < nota;

    html += `
      <img src="${cheia ? ICONES.starCheia : ICONES.star}" class="${cheia ? "estrela-cheia" : "estrela-vazia"}" alt="${cheia ? "Estrela" : "Vazia"}" onerror="this.style.display='none'">
    `;
  }

  return html + `</span>`;
}

function normalizarTexto(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(t) {
  return normalizarTexto(t)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numeroPreco(v) {
  let t = String(v || "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/[^\d.,]/g, "");

  if (!t) return 0;

  if (t.includes(",") && t.includes(".")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (t.includes(",")) {
    t = t.replace(",", ".");
  }

  return Number(t) || 0;
}

function precoProduto(p) {
  return numeroPreco(p.preco || p.precoAtual || p.valor || 0);
}

function dataProduto(p) {
  for (const c of [p.criadoEm, p.createdAt, p.dataCriacao, p.atualizadoEm, p.updatedAt]) {
    if (!c) continue;

    if (typeof c?.toDate === "function") {
      const t = c.toDate().getTime();

      if (!Number.isNaN(t)) return t;
    }

    const t = new Date(c).getTime();

    if (!Number.isNaN(t)) return t;
  }

  return 0;
}

function textoBuscaProduto(p) {
  return normalizarTexto(`
    ${p.nome || ""}
    ${p.categoria || ""}
    ${p.plataforma || ""}
    ${p.departamento || ""}
    ${p.subcategoria || ""}
    ${p.descricao || ""}
    ${p.preco || ""}
    ${p.selo || ""}
    ${p.urgencia || ""}
    ${(p.detalhes || []).join(" ")}
    ${(p.observacoes || []).join(" ")}
  `);
}

function corSeguraCategoria(cor, padrao = "#22c55e") {
  const v = String(cor || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();

  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map(l => l + l)
        .join("")
        .toLowerCase()
    );
  }

  return padrao;
}

function corPadraoCategoria(slug, nome = "") {
  const t = `${slug} ${nome}`.toLowerCase();

  if (t.includes("mercado")) return "#facc15";
  if (t.includes("shopee")) return "#f97316";
  if (t.includes("cakto")) return "#22c55e";
  if (t.includes("amazon")) return "#0ea5e9";
  if (t.includes("digital")) return "#8b5cf6";

  return "#22c55e";
}

function escolherIconeCategoria(n, s) {
  const t = `${n} ${s}`.toLowerCase();

  if (t.includes("mercado")) return ICONES.shoppingCart;
  if (t.includes("shopee")) return ICONES.shoppingCart;
  if (t.includes("cakto")) return ICONES.package;
  if (t.includes("digital")) return ICONES.package;

  return ICONES.package;
}

function escaparHTML(t) {
  return String(t || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparJS(t) {
  return String(t || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;");
}

/* =========================================================
   FUNÇÕES GLOBAIS
========================================================= */

window.abrirPopupProduto = abrirPopupProduto;
window.fecharPopup = fecharPopup;
window.compartilharProduto = compartilharProduto;
window.atualizarImagem = atualizarImagem;
window.proximaImagemPopup = proximaImagemPopup;
window.imagemAnteriorPopup = imagemAnteriorPopup;
window.filtrarCategoria = filtrarCategoria;
window.filtrarPlataforma = filtrarPlataforma;
window.filtrarDepartamento = filtrarDepartamento;
window.filtrarSubcategoria = filtrarSubcategoria;
window.limparFiltrosHierarquia = limparFiltrosHierarquia;
window.filtrarRapido = filtrarRapido;
window.toggleComentarios = toggleComentarios;
window.trocarPaginaProdutos = trocarPaginaProdutos;
window.abrirPopupSucessoComentario = abrirPopupSucessoComentario;
window.fecharPopupSucessoComentario = fecharPopupSucessoComentario;
window.bloquearZoomSite = bloquearZoomSite;
window.atualizarAreaDestaque = atualizarAreaDestaque;
window.abrirChatProduto = abrirChatProduto;
window.fecharChatProduto = fecharChatProduto;
window.minimizarChatProduto = minimizarChatProduto;
window.enviarPerguntaChatProduto = enviarPerguntaChatProduto;