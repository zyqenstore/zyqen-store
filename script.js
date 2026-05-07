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
let listaCategorias = [];
let categoriaAtual = "Todos";
let produtoAtualPopup = null;
let midiasProdutoAtual = [];
let comentarioEnviando = false;

let paginasCategorias = {};
let ordenarAtual = "relevancia";
let filtroRapidoAtual = "todos";
let cliquesEmAndamento = new Set();

let timerDetectarDispositivo = null;

// 🔥 Cache dos selos de confiança
let selosConfianca = [];

// 🔥 CAMINHO DOS ÍCONES DE PRODUTO
const BASE_ICONES_PRODUTO = "imagens/pagina-produtos/";

const PRODUTOS_POR_PAGINA = 8;
const TEMPO_BLOQUEIO_CLIQUE = 30 * 1000;

const ESTRELA_CHEIA_AMARELA = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
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
  // 🔥 NOVOS ÍCONES
  truck: BASE_ICONES_PRODUTO + "truck.svg",
  checkSquare: BASE_ICONES_PRODUTO + "check-square.svg",
  rotate: BASE_ICONES_PRODUTO + "rotate.svg",
  shield: BASE_ICONES_PRODUTO + "shield.svg",
  clipboardList: BASE_ICONES_PRODUTO + "clipboard-list.svg",
  creditCard: BASE_ICONES_PRODUTO + "credit-card.svg",
  cart: BASE_ICONES_PRODUTO + "shopping-cart.svg"
};

// 🔥 MAPEAMENTO DE CORES POR ÍCONE (docId -> cor)
const CORES_ICONES_SELOS = {
  frete: "verde",
  loja: "verde",
  devolucao: "azul",
  garantia: "azul"
};

const IMAGEM_FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 700 500">
  <rect width="700" height="500" fill="#020617"/>
  <rect x="30" y="30" width="640" height="440" rx="32" fill="#0f172a" stroke="#334155" stroke-width="4"/>
  <circle cx="250" cy="210" r="50" fill="#1e293b"/>
  <path d="M120 390 L280 260 L390 350 L470 290 L590 390 Z" fill="#1e293b"/>
  <text x="350" y="448" text-anchor="middle" fill="#94a3b8" font-size="28" font-family="Arial">Imagem não encontrada</text>
</svg>
`);

function iconeSelo(nome) { return BASE_ICONES_PRODUTO + nome + ".svg"; }

document.addEventListener("DOMContentLoaded", () => {
  detectarDispositivo();
  bloquearZoomSite();
  ajustarSiteFixo();
  prepararConfiancaMobile();

  injetarEstiloBuscaInteligente();
  injetarEstiloPaginacao();
  injetarEstiloIconesJS();
  injetarEstiloSelosConfianca();

  criarControlesBuscaInteligente();
  garantirEstruturaDinamica();

  carregarCategoriasFirebase();
  carregarProdutosFirebase();
  carregarSelosConfianca();

  prepararFormularioComentario();
  prepararCliquesInstagram();
  ativarSwipeImagem();

  const pesquisa = document.getElementById("pesquisa");
  if (pesquisa) {
    pesquisa.addEventListener("input", () => {
      resetarPaginas();
      aplicarFiltros();
    });
  }
  window.addEventListener("resize", agendarDetectarDispositivo);
  window.addEventListener("orientationchange", agendarDetectarDispositivo);
});

function detectarDispositivo() {
  const html = document.documentElement;
  const body = document.body;
  if (!body) return;
  const largura = window.innerWidth || html.clientWidth || 0;
  const ehTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  const ponteiroFino = window.matchMedia("(pointer: fine)").matches;
  const hoverReal = window.matchMedia("(hover: hover)").matches;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  const classesDispositivo = ["modo-mobile", "modo-tablet", "modo-desktop", "tem-touch", "sem-touch"];
  html.classList.remove(...classesDispositivo);
  body.classList.remove(...classesDispositivo);
  let dispositivo = "desktop";
  if (largura <= 768 || mobileUserAgent) { dispositivo = "mobile"; }
  else if (largura <= 1180 || (ehTouch && largura <= 1366 && !(ponteiroFino && hoverReal))) { dispositivo = "tablet"; }
  const classeDispositivo = `modo-${dispositivo}`;
  const classeTouch = ehTouch ? "tem-touch" : "sem-touch";
  html.classList.add(classeDispositivo, classeTouch);
  body.classList.add(classeDispositivo, classeTouch);
  html.dataset.dispositivo = dispositivo;
  body.dataset.dispositivo = dispositivo;
}

function agendarDetectarDispositivo() {
  clearTimeout(timerDetectarDispositivo);
  timerDetectarDispositivo = setTimeout(() => { detectarDispositivo(); }, 120);
}

function bloquearZoomSite() {
  const html = document.documentElement;
  const body = document.body;
  const ehMobile = window.matchMedia("(max-width: 900px)").matches;
  html.style.overflowX = "hidden";
  html.style.maxWidth = "100%";
  body.style.overflowX = "hidden";
  body.style.maxWidth = "100%";
  if (!ehMobile) { html.style.touchAction = "auto"; body.style.touchAction = "auto"; return; }
  html.style.touchAction = "manipulation";
  body.style.touchAction = "manipulation";
  const impedir = (event) => { event.preventDefault(); };
  document.addEventListener("gesturestart", impedir, { passive: false });
  document.addEventListener("gesturechange", impedir, { passive: false });
  document.addEventListener("gestureend", impedir, { passive: false });
  document.addEventListener("touchmove", (event) => { if (event.touches && event.touches.length > 1) { event.preventDefault(); } }, { passive: false });
  let ultimoToque = 0;
  document.addEventListener("touchend", (event) => { const agora = Date.now(); if (agora - ultimoToque <= 320) { event.preventDefault(); } ultimoToque = agora; }, { passive: false });
  document.addEventListener("wheel", (event) => { if (!window.matchMedia("(max-width: 900px)").matches) return; if (event.ctrlKey || event.metaKey) { event.preventDefault(); } }, { passive: false });
  document.addEventListener("keydown", (event) => { if (!window.matchMedia("(max-width: 900px)").matches) return; const tecla = String(event.key || "").toLowerCase(); const teclaZoom = ["+","-","=","0","_","add","subtract"].includes(tecla); if ((event.ctrlKey || event.metaKey) && teclaZoom) { event.preventDefault(); } }, { passive: false });
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
    if (wrapper) { wrapper.style.width = "100%"; wrapper.style.maxWidth = "100%"; wrapper.style.overflowX = "hidden"; }
  };
  aplicar();
  window.addEventListener("resize", aplicar);
}

function prepararConfiancaMobile() {
  const cards = Array.from(document.querySelectorAll(".confianca-card"));
  if (!cards.length) return;
  let modal = document.getElementById("modal-confianca");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-confianca";
    modal.className = "modal-confianca";
    modal.innerHTML = `<div class="modal-confianca-card"><button type="button" class="modal-confianca-fechar" aria-label="Fechar">×</button><div class="modal-confianca-icone"></div><h3 class="modal-confianca-titulo"></h3><p class="modal-confianca-texto"></p></div>`;
    document.body.appendChild(modal);
  }
  const fechar = () => { modal.classList.remove("ativo"); };
  const botaoFechar = modal.querySelector(".modal-confianca-fechar");
  if (botaoFechar && botaoFechar.dataset.listenerAtivo !== "sim") { botaoFechar.dataset.listenerAtivo = "sim"; botaoFechar.addEventListener("click", fechar); }
  if (modal.dataset.listenerAtivo !== "sim") {
    modal.dataset.listenerAtivo = "sim";
    modal.addEventListener("click", (event) => { if (event.target === modal) { fechar(); } });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { fechar(); } });
  }
  cards.forEach((card) => {
    if (card.dataset.confiancaMobileAtivo === "sim") return;
    card.dataset.confiancaMobileAtivo = "sim";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    const abrir = () => {
      const ehMobile = window.matchMedia("(max-width: 900px)").matches;
      if (!ehMobile) return;
      const titulo = card.querySelector("h3")?.textContent?.trim() || "";
      const texto = card.querySelector("p")?.textContent?.trim() || "";
      const iconeOriginal = card.querySelector(".icone-circulo img") || card.querySelector(".icone-circulo svg") || card.querySelector("img") || card.querySelector("svg");
      const modalIcone = modal.querySelector(".modal-confianca-icone");
      const modalTitulo = modal.querySelector(".modal-confianca-titulo");
      const modalTexto = modal.querySelector(".modal-confianca-texto");
      if (modalTitulo) modalTitulo.textContent = titulo;
      if (modalTexto) modalTexto.textContent = texto;
      if (modalIcone) { modalIcone.innerHTML = ""; if (iconeOriginal) { const clone = iconeOriginal.cloneNode(true); clone.removeAttribute("id"); modalIcone.appendChild(clone); } }
      modal.classList.add("ativo");
    };
    card.addEventListener("click", abrir);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); abrir(); } });
  });
}

function carregarSelosConfianca() {
  const selosRef = collection(db, "selosConfianca");
  const q = query(selosRef);
  onSnapshot(q, (snapshot) => {
    selosConfianca = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })).filter(selo => selo.ativo !== false);
    if (selosConfianca.length === 0) {
      selosConfianca = [
        { docId: "frete", icone: ICONES.truck, titulo: "Frete Grátis", descricao: "Chegará grátis", ativo: true },
        { docId: "loja", icone: ICONES.checkSquare, titulo: "Loja Oficial", descricao: "+10mil vendidos", ativo: true },
        { docId: "devolucao", icone: ICONES.rotate, titulo: "Devolução Grátis", descricao: "Até 30 dias", ativo: true },
        { docId: "garantia", icone: ICONES.shield, titulo: "Compra Garantida", descricao: "Protegida pela plataforma", ativo: true }
      ];
    }
    if (produtoAtualPopup) { renderizarBlocoConfianca(); }
  }, (erro) => { console.warn("Erro ao carregar selos.", erro); });
}

function renderizarBlocoConfianca() {
  const bloco = document.getElementById("popup-confianca-bloco");
  if (!bloco) return;
  const selosAtivos = selosConfianca.filter(s => s.ativo !== false);
  if (selosAtivos.length === 0) { bloco.style.display = "none"; return; }
  bloco.style.display = "grid";
  bloco.innerHTML = selosAtivos.map(selo => {
    const corClasse = CORES_ICONES_SELOS[selo.docId] === "azul" ? "icone-selo-azul" : "icone-selo-verde";
    return `<div class="confianca-item"><img src="${escaparHTML(selo.icone || ICONES.shield)}" alt="${escaparHTML(selo.titulo || "")}" class="${corClasse}" onerror="this.style.display='none'"><div><strong>${escaparHTML(selo.titulo || "")}</strong><small>${escaparHTML(selo.descricao || "")}</small></div></div>`;
  }).join("");
}

function injetarEstiloSelosConfianca() {
  if (document.getElementById("css-selos-confianca-zyqen")) return;
  const style = document.createElement("style");
  style.id = "css-selos-confianca-zyqen";
  style.innerHTML = `
    .popup-precos-area{margin:16px 0;padding:0;background:transparent;border:none;border-radius:0}
    #popup-nome{font-weight:700!important;font-size:1.2rem!important;line-height:1.3!important}
    #popup-preco{display:block;color:#00a650;font-size:2.2rem;font-weight:700;line-height:1.2;margin:4px 0 2px}
    #popup-preco-antigo{display:block;color:#999;text-decoration:line-through;font-size:1rem;margin-bottom:2px;font-weight:400}
    #popup-parcelamento,.popup-parcelamento{display:block;color:#22d3ee;font-size:0.95rem;font-weight:400;margin-top:8px;padding:0;border-top:none}
    #popup-destaque-parcelamento{display:block;color:#94a3b8;font-size:0.85rem;font-weight:400;margin-top:6px;padding:0;line-height:1.3}
    .popup-confianca-bloco{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;padding:0;background:transparent;border:none;border-radius:0}
    .confianca-item{display:flex;align-items:flex-start;gap:8px;font-size:0.8rem;padding:0}
    .icone-selo-verde{width:20px;height:20px;object-fit:contain;flex-shrink:0;margin-top:2px;filter:brightness(0) saturate(100%) invert(62%) sepia(84%) saturate(404%) hue-rotate(88deg) brightness(94%) contrast(89%)}
    .icone-selo-azul{width:20px;height:20px;object-fit:contain;flex-shrink:0;margin-top:2px;filter:brightness(0) saturate(100%) invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%)}
    .confianca-item strong{display:block;color:#fff;font-weight:600;font-size:0.85rem;line-height:1.3}
    .confianca-item small{display:block;color:#999;font-size:0.75rem;font-weight:400;line-height:1.3}
    .titulo-secao-popup{font-size:1rem;font-weight:700;color:#fff;margin:24px 0 12px;border-bottom:none;padding-bottom:0}
    .icone-titulo-azul{width:18px;height:18px;object-fit:contain;margin-right:6px;vertical-align:middle;filter:brightness(0) saturate(100%) invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%)}
    #popup-comprar,.btn-comprar,.popup-comprar{background:#00a650!important;font-size:1rem!important;font-weight:700!important;letter-spacing:0!important;box-shadow:none!important;flex:2!important;border-radius:6px!important}
    #popup-comprar .icone-carrinho{width:18px;height:18px;object-fit:contain;margin-right:6px;filter:brightness(0) invert(1)}
    #popup-whatsapp,.btn-chat{flex:1!important;font-size:0.9rem!important;font-weight:600!important;background:#1e293b!important;border:1px solid #334155!important;border-radius:6px!important}
    .icone-parcelamento-azul{width:18px;height:18px;object-fit:contain;flex-shrink:0;vertical-align:middle;margin-right:4px;filter:brightness(0) saturate(100%) invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%)}
    @media(max-width:900px){.popup-confianca-bloco{gap:12px}.icone-selo-verde,.icone-selo-azul{width:18px;height:18px}}
  `;
  document.head.appendChild(style);
}

function carregarCategoriasFirebase() {
  const categoriasRef = collection(db, "categorias");
  const q = query(categoriasRef);
  onSnapshot(q, (snapshot) => {
    listaCategorias = snapshot.docs.map(d => normalizarCategoria({ docId: d.id, ...d.data() })).filter(c => c.ativa !== false).sort((a, b) => { const oa = Number(a.ordem) || 999; const ob = Number(b.ordem) || 999; if (oa !== ob) return oa - ob; return a.nome.localeCompare(b.nome); });
    aplicarFiltros();
  }, () => { listaCategorias = []; aplicarFiltros(); });
}

function carregarProdutosFirebase() {
  const produtosRef = collection(db, "produtos");
  const q = query(produtosRef);
  onSnapshot(q, (snapshot) => {
    listaProdutos = snapshot.docs.map(d => normalizarProduto({ docId: d.id, ...d.data() })).filter(produtoEstaAtivo);
    mostrarProdutoDestaque();
    aplicarFiltros();
    if (produtoAtualPopup) {
      const att = listaProdutos.find(p => String(p.id) === String(produtoAtualPopup.id) || String(p.docId) === String(produtoAtualPopup.docId));
      if (att) { produtoAtualPopup = att; midiasProdutoAtual = montarMidiasProduto(att); mostrarComentariosProduto(att); }
      else { fecharPopup(); produtoAtualPopup = null; midiasProdutoAtual = []; }
    }
  }, () => { alert("Erro ao carregar produtos."); });
}

function produtoEstaAtivo(p) { return p.ativo !== false; }

function normalizarProduto(p) {
  const cn = p.categoria || p.categoriaNome || "";
  const cs = p.categoriaSlug || slugify(cn);
  return {
    ...p, ativo: p.ativo !== false, categoria: cn, categoriaSlug: cs,
    imagens: Array.isArray(p.imagens) ? p.imagens.filter(Boolean) : [],
    videos: Array.isArray(p.videos) ? p.videos.filter(Boolean) : [],
    comentarios: Array.isArray(p.comentarios) ? p.comentarios : [],
    detalhes: Array.isArray(p.detalhes) ? p.detalhes : [],
    observacoes: Array.isArray(p.observacoes) ? p.observacoes : [],
    avaliacao: Number(p.avaliacao) || 0, avaliacoes: Number(p.avaliacoes) || 0,
    vendidos: Number(p.vendidos) || 0, ordem: Number(p.ordem) || 999,
    cliquesComprar: Number(p.cliquesComprar) || 0, cliquesWhatsapp: Number(p.cliquesWhatsapp) || 0,
    cliquesCompartilhar: Number(p.cliquesCompartilhar) || 0, cliquesInstagram: Number(p.cliquesInstagram) || 0,
    cliquesTotal: Number(p.cliquesTotal) || 0,
    parcelamento: String(p.parcelamento || "").trim(),
    // 🔥 NOVOS CAMPOS
    textoParcelamento: String(p.textoParcelamento || "").trim(),
    textoDestaque: String(p.textoDestaque || "").trim()
  };
}

function corSeguraCategoria(cor, padrao = "#22c55e") { const v = String(cor || "").trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase(); if (/^#[0-9a-fA-F]{3}$/.test(v)) return "#" + v.slice(1).split("").map(l => l + l).join("").toLowerCase(); return padrao; }
function corPadraoCategoria(slug, nome = "") { const t = `${slug} ${nome}`.toLowerCase(); if (t.includes("mercado")) return "#facc15"; if (t.includes("shopee")) return "#f97316"; if (t.includes("cakto")) return "#22c55e"; if (t.includes("amazon")) return "#0ea5e9"; if (t.includes("digital")) return "#8b5cf6"; return "#22c55e"; }
function normalizarCategoria(c) { const n = c.nome || c.categoria || "Categoria"; const s = c.slug || slugify(n); const cp = corPadraoCategoria(s, n); return { docId: c.docId || "", nome: n, slug: s, tipo: c.tipo || "produto", caminhoImagens: c.caminhoImagens || `imagens/${s}/`, caminhoVideos: c.caminhoVideos || `videos/${s}/`, caminhoIcones: c.caminhoIcones || "imagens/icones/", extImagem: c.extImagem || ".jpg", extVideo: c.extVideo || ".mp4", extIcone: c.extIcone || ".svg", icone: c.icone || escolherIconeCategoria(n, s), corLinha: corSeguraCategoria(c.corLinha || c.corCategoria, cp), ordem: Number(c.ordem) || 999, ativa: c.ativa !== false }; }
function categoriasPadrao() { return [{ nome: "Mercado Livre", slug: "mercado-livre", tipo: "produto", caminhoImagens: "imagens/mercado/", caminhoVideos: "videos/mercado/", caminhoIcones: "imagens/icones/", extImagem: ".jpg", extVideo: ".mp4", extIcone: ".svg", icone: ICONES.shoppingCart, corLinha: "#facc15", ordem: 1, ativa: true }, { nome: "Cakto", slug: "cakto", tipo: "cakto", caminhoImagens: "imagens/cakto/", caminhoVideos: "videos/cakto/", caminhoIcones: "imagens/icones/", extImagem: ".jpg", extVideo: ".mp4", extIcone: ".svg", icone: ICONES.package, corLinha: "#22c55e", ordem: 2, ativa: true }]; }
function escolherIconeCategoria(n, s) { const t = `${n} ${s}`.toLowerCase(); if (t.includes("mercado")) return ICONES.shoppingCart; if (t.includes("cakto")) return ICONES.package; return ICONES.package; }
function categoriasAtivasComFallback() { const m = new Map(); if (listaCategorias.length > 0) { listaCategorias.forEach(c => m.set(c.slug, c)); } else { categoriasPadrao().forEach(c => m.set(c.slug, c)); } listaProdutos.forEach(p => { const n = p.categoria || p.categoriaNome || p.categoriaSlug || ""; const s = p.categoriaSlug || slugify(n); if (!n && !s) return; if (!m.has(s)) { m.set(s, normalizarCategoria({ nome: n || s, slug: s, tipo: p.tipo || "produto", ordem: 999 })); } }); return Array.from(m.values()).sort((a, b) => { const oa = Number(a.ordem) || 999; const ob = Number(b.ordem) || 999; if (oa !== ob) return oa - ob; return a.nome.localeCompare(b.nome); }); }
function produtoPertenceCategoria(p, c) { const pn = String(p.categoria || p.categoriaNome || "").trim(); const ps = String(p.categoriaSlug || slugify(pn)).trim(); return (ps === c.slug || slugify(pn) === c.slug || pn.toLowerCase() === c.nome.toLowerCase()); }
function nomeCategoriaProduto(p) { const cats = categoriasAtivasComFallback(); const f = cats.find(c => produtoPertenceCategoria(p, c)); return f ? f.nome : p.categoria || p.categoriaSlug || "Produto"; }

function criarControlesBuscaInteligente() { const pesquisa = document.getElementById("pesquisa"); if (!pesquisa) return; const antigoPai = pesquisa.parentElement; limparIconesBuscaSoltos(pesquisa); let painel = document.getElementById("painelBuscaInteligente"); if (!painel) { painel = document.createElement("div"); painel.id = "painelBuscaInteligente"; painel.className = "busca-inteligente-painel"; painel.innerHTML = `<div class="busca-inteligente-topo"><div><strong>Encontre sua oferta</strong><span>Pesquise por nome, categoria, preço, selo, descrição ou palavras do produto.</span></div></div><div class="busca-linha-superior"><div class="campo-pesquisa-organizado" id="campoPesquisaOrganizado"><img src="${ICONES.search}" alt="Pesquisar"></div><select id="ordenarProdutos" class="ordenar-produtos-js"><option value="relevancia">Ordenar por relevância</option><option value="menor-preco">Menor preço</option><option value="maior-preco">Maior preço</option><option value="mais-avaliados">Mais avaliados</option><option value="mais-vendidos">Mais vendidos</option><option value="novidades">Novidades</option></select></div><div class="grupo-filtros-rapidos"><div class="titulo-filtro-organizado">Filtros rápidos</div><div id="filtrosRapidosBusca" class="filtros-rapidos-busca"><button type="button" class="ativo" data-filtro-rapido="todos">Todos</button><button type="button" data-filtro-rapido="mais-vendido">Mais vendidos</button><button type="button" data-filtro-rapido="novidade">Novidades</button><button type="button" data-filtro-rapido="promocao">Promoções</button><button type="button" data-filtro-rapido="recomendado">Recomendados</button></div></div>`; if (antigoPai && antigoPai.parentElement) { antigoPai.parentElement.insertBefore(painel, antigoPai); } else { pesquisa.insertAdjacentElement("beforebegin", painel); } } const campoPesquisa = document.getElementById("campoPesquisaOrganizado"); if (campoPesquisa && pesquisa.parentElement !== campoPesquisa) { campoPesquisa.appendChild(pesquisa); } pesquisa.classList.add("pesquisa-organizada-js"); if (antigoPai && antigoPai !== document.body) { antigoPai.classList.add("busca-antiga-limpa"); } const ordenar = document.getElementById("ordenarProdutos"); if (ordenar && ordenar.dataset.listenerAtivo !== "sim") { ordenar.dataset.listenerAtivo = "sim"; ordenar.addEventListener("change", () => { ordenarAtual = ordenar.value || "relevancia"; resetarPaginas(); aplicarFiltros(); }); } document.querySelectorAll("#filtrosRapidosBusca button").forEach(btn => { if (btn.dataset.listenerAtivo === "sim") return; btn.dataset.listenerAtivo = "sim"; btn.addEventListener("click", () => { filtrarRapido(btn.dataset.filtroRapido || "todos"); }); }); }
function limparIconesBuscaSoltos(pesquisa) { const pai = pesquisa?.parentElement; if (!pai) return; Array.from(pai.children).forEach(el => { if (el === pesquisa) return; const tag = el.tagName?.toLowerCase(); const classe = String(el.className || "").toLowerCase(); if (tag === "svg" || tag === "i" || (tag === "img" && (classe.includes("search") || classe.includes("busca") || classe.includes("lupa") || classe.includes("icone"))) || classe.includes("search") || classe.includes("busca") || classe.includes("lupa")) { el.style.display = "none"; el.setAttribute("aria-hidden", "true"); } }); }
function filtrarRapido(tipo) { filtroRapidoAtual = tipo || "todos"; document.querySelectorAll("#filtrosRapidosBusca button").forEach(btn => { btn.classList.toggle("ativo", btn.dataset.filtroRapido === filtroRapidoAtual); }); resetarPaginas(); aplicarFiltros(); }
function aplicarFiltros() { const pesquisa = document.getElementById("pesquisa"); const termo = pesquisa ? pesquisa.value : ""; let filtrados = listaProdutos.filter(p => produtoEstaAtivo(p) && produtoCombinaPesquisa(p, termo) && produtoCombinaFiltroRapido(p)); if (categoriaAtual !== "Todos") { const cats = categoriasAtivasComFallback(); const sel = cats.find(c => c.slug === categoriaAtual); if (sel) { filtrados = filtrados.filter(p => produtoPertenceCategoria(p, sel)); } } filtrados = aplicarOrdenacaoProdutos(filtrados); mostrarProdutosPorCategoria(filtrados); }
function filtrarCategoria(cat) { categoriaAtual = cat; resetarPaginas(); aplicarFiltros(); }
function produtoCombinaPesquisa(p, termo) { const tn = normalizarTexto(termo); if (!tn) return true; const texto = textoBuscaProduto(p); const palavras = tn.split(/\s+/).map(w => w.trim()).filter(Boolean); return palavras.every(w => texto.includes(w)); }
function produtoCombinaFiltroRapido(p) { const t = textoBuscaProduto(p); if (filtroRapidoAtual === "todos") return true; if (filtroRapidoAtual === "mais-vendido") return (t.includes("mais vendido") || t.includes("vendidos") || Number(p.vendidos) > 0); if (filtroRapidoAtual === "novidade") return (t.includes("novidade") || t.includes("lancamento") || t.includes("lançamento")); if (filtroRapidoAtual === "promocao") return (t.includes("promocao") || t.includes("promoção") || t.includes("oferta") || Boolean(p.precoAntigo) || Boolean(p.destaque)); if (filtroRapidoAtual === "recomendado") return (Boolean(p.recomendado) || t.includes("recomendado")); return true; }
function aplicarOrdenacaoProdutos(produtos) { const l = produtos.slice(); if (ordenarAtual === "menor-preco") return l.sort((a, b) => { const pa = precoProduto(a); const pb = precoProduto(b); if (pa === 0 && pb !== 0) return 1; if (pb === 0 && pa !== 0) return -1; return pa - pb; }); if (ordenarAtual === "maior-preco") return l.sort((a, b) => precoProduto(b) - precoProduto(a)); if (ordenarAtual === "mais-avaliados") return l.sort((a, b) => { const nb = Number(b.avaliacao) || 0; const na = Number(a.avaliacao) || 0; if (nb !== na) return nb - na; return (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0); }); if (ordenarAtual === "mais-vendidos") return l.sort((a, b) => { const vb = Number(b.vendidos) || 0; const va = Number(a.vendidos) || 0; if (vb !== va) return vb - va; return (Number(b.cliquesTotal) || 0) - (Number(a.cliquesTotal) || 0); }); if (ordenarAtual === "novidades") return l.sort((a, b) => { const db = dataProduto(b); const da = dataProduto(a); if (db !== da) return db - da; return String(b.nome || "").localeCompare(String(a.nome || "")); }); return l.sort((a, b) => { if ((a.destaque ? 1 : 0) !== (b.destaque ? 1 : 0)) return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0); const oa = Number(a.ordem) || 999; const ob = Number(b.ordem) || 999; if (oa !== ob) return oa - ob; if ((a.recomendado ? 1 : 0) !== (b.recomendado ? 1 : 0)) return (b.recomendado ? 1 : 0) - (a.recomendado ? 1 : 0); return String(a.nome || "").localeCompare(String(b.nome || "")); }); }

function garantirEstruturaDinamica() { if (document.getElementById("categorias-container")) return; const mercado = document.getElementById("produtos-mercado"); const cakto = document.getElementById("produtos-cakto"); if (mercado || cakto) { const ps = mercado?.closest("section") || cakto?.closest("section"); if (ps && ps.parentElement) { const c = document.createElement("div"); c.id = "categorias-container"; ps.parentElement.insertBefore(c, ps); if (mercado?.closest("section")) mercado.closest("section").style.display = "none"; if (cakto?.closest("section")) cakto.closest("section").style.display = "none"; } } }
function mostrarProdutosPorCategoria(produtos) { const cats = categoriasAtivasComFallback(); renderizarBotoesFiltro(cats); let mostrar = cats; if (categoriaAtual !== "Todos") { mostrar = cats.filter(c => c.slug === categoriaAtual); } renderizarSecoesCategorias(mostrar); if (mostrar.length === 0) { const container = document.getElementById("categorias-container"); if (container) container.innerHTML = `<div class="categoria-loading">Categoria não encontrada.</div>`; return; } mostrar.forEach(cat => { renderizarProdutosComPaginacao(produtos.filter(p => produtoPertenceCategoria(p, cat)), cat); }); }
function renderizarBotoesFiltro(cats) { const area = document.getElementById("botoes-filtro"); if (!area) return; area.classList.add("filtros-categoria-loja"); let botoes = `<button onclick="filtrarCategoria('Todos')" class="${categoriaAtual === "Todos" ? "ativo" : ""}" data-categoria="Todos">Todos</button>`; cats.forEach(c => { botoes += `<button onclick="filtrarCategoria('${escaparJS(c.slug)}')" class="${categoriaAtual === c.slug ? "ativo" : ""}" data-categoria="${escaparHTML(c.slug)}">${escaparHTML(c.nome)}</button>`; }); area.innerHTML = `<div class="titulo-categorias-organizado">Categorias</div><div class="botoes-categoria-organizado">${botoes}</div>`; }
function renderizarSecoesCategorias(cats) { const container = document.getElementById("categorias-container"); if (!container) return; if (cats.length === 0) { container.innerHTML = `<div class="categoria-loading">Nenhuma categoria encontrada.</div>`; return; } container.innerHTML = cats.map(c => `<section id="secao-${escaparHTML(c.slug)}" class="categoria-loja" data-categoria="${escaparHTML(c.slug)}" style="--cor-categoria:${corSeguraCategoria(c.corLinha, corPadraoCategoria(c.slug, c.nome))}"><h2 class="titulo-categoria-dinamica" style="--cor-categoria:${corSeguraCategoria(c.corLinha, corPadraoCategoria(c.slug, c.nome))}"><img src="${c.icone || ICONES.package}" alt="${escaparHTML(c.nome)}" onerror="this.onerror=null;this.src='${ICONES.package}'">${escaparHTML(c.nome)}</h2><div id="produtos-${escaparHTML(c.slug)}" class="grid"></div><div id="paginacao-${escaparHTML(c.slug)}" class="paginacao-loja"></div></section>`).join(""); }
function renderizarProdutosComPaginacao(prods, cat) { const grid = document.getElementById(`produtos-${cat.slug}`); const secao = document.getElementById(`secao-${cat.slug}`); const pag = document.getElementById(`paginacao-${cat.slug}`); if (!grid || !secao) return; if (prods.length === 0) { secao.style.display = categoriaAtual === "Todos" ? "none" : "block"; grid.innerHTML = categoriaAtual !== "Todos" ? `<div class="categoria-sem-produtos">Nenhum produto encontrado.</div>` : ""; if (pag) pag.innerHTML = ""; return; } secao.style.display = "block"; const tp = Math.ceil(prods.length / PRODUTOS_POR_PAGINA); let pa = pegarPaginaAtual(cat.slug); if (pa > tp) pa = tp; if (pa < 1) pa = 1; definirPaginaAtual(cat.slug, pa); const inicio = (pa - 1) * PRODUTOS_POR_PAGINA; grid.innerHTML = prods.slice(inicio, inicio + PRODUTOS_POR_PAGINA).map(criarCardProduto).join(""); renderizarPaginacao(cat.slug, prods.length, pag); }
function criarCardProduto(p) { return `<div class="produto" onclick="abrirPopupProduto('${escaparJS(p.id || p.docId)}')">${p.urgencia ? `<div class="urgencia">${escaparHTML(p.urgencia)}</div>` : ""}<div class="imagem-area"><img src="${p.imagens?.[0] || IMAGEM_FALLBACK}" alt="${escaparHTML(p.nome || "Produto")}" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"></div><h2>${escaparHTML(p.nome || "")}</h2><div class="avaliacao">${gerarEstrelas(Number(p.avaliacao) || 0)}<span>${p.avaliacao || "5.0"}</span></div><strong>${escaparHTML(p.preco || "")}</strong>${p.parcelamento ? `<span class="produto-parcelamento">${escaparHTML(p.parcelamento)}</span>` : ""}</div>`; }

function resetarPaginas() { paginasCategorias = {}; }
function pegarPaginaAtual(slug) { return paginasCategorias[slug] || 1; }
function definirPaginaAtual(slug, pagina) { paginasCategorias[slug] = pagina; }
function trocarPaginaProdutos(slug, pagina) { definirPaginaAtual(slug, pagina); aplicarFiltros(); const secao = document.getElementById(`secao-${slug}`); if (secao) setTimeout(() => secao.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }
function gerarListaPaginas(total, atual) { const pags = []; if (total <= 7) { for (let i = 1; i <= total; i++) pags.push(i); return pags; } pags.push(1); if (atual > 3) pags.push("..."); const ini = Math.max(2, atual - 1); const fim = Math.min(total - 1, atual + 1); for (let i = ini; i <= fim; i++) pags.push(i); if (atual < total - 2) pags.push("..."); pags.push(total); return pags; }
function renderizarPaginacao(slug, total, el) { if (!el) return; const tp = Math.ceil(total / PRODUTOS_POR_PAGINA); const pa = pegarPaginaAtual(slug); if (tp <= 1) { el.innerHTML = ""; return; } const pags = gerarListaPaginas(tp, pa); let h = `<button onclick="trocarPaginaProdutos('${slug}', ${Math.max(1, pa - 1)})" ${pa === 1 ? "disabled" : ""} title="Anterior"><img src="${ICONES.chevronLeft}" alt="Anterior"></button>`; pags.forEach(p => { if (p === "...") h += `<span class="paginacao-reticencias">...</span>`; else h += `<button onclick="trocarPaginaProdutos('${slug}', ${p})" class="${p === pa ? "ativo" : ""}">${p}</button>`; }); h += `<button onclick="trocarPaginaProdutos('${slug}', ${Math.min(tp, pa + 1)})" ${pa === tp ? "disabled" : ""} title="Próxima"><img src="${ICONES.chevronRight}" alt="Próxima"></button>`; h += `<div class="paginacao-info">Página ${pa} de ${tp} • ${total} produto(s)</div>`; el.innerHTML = h; }

function mostrarProdutoDestaque() { const d = listaProdutos.find(p => produtoEstaAtivo(p) && p.destaque === true); const area = document.getElementById("produto-destaque"); if (!area) return; area.innerHTML = d ? criarCardProduto(d) : ""; atualizarAreaDestaque(); }
function atualizarAreaDestaque() { const area = document.getElementById("area-oferta-dia"); const pd = document.getElementById("produto-destaque"); if (!area || !pd) return; const tem = Boolean(pd.querySelector(".produto")); if (tem) { area.hidden = false; area.classList.add("tem-destaque"); } else { area.classList.remove("tem-destaque"); area.hidden = true; } }

// 🔥 FUNÇÃO PRINCIPAL DO POPUP
function abrirPopupProduto(id) {
  const produto = listaProdutos.find(p => String(p.id) === String(id) || String(p.docId) === String(id));
  if (!produto) { alert("Produto não encontrado."); return; }
  produtoAtualPopup = produto; midiasProdutoAtual = montarMidiasProduto(produto); renderizarMidiaPopup(0);

  const nomeEl = document.getElementById("popup-nome"); if (nomeEl) nomeEl.textContent = produto.nome || "";

  const media = Number(produto.avaliacao) || 0;
  document.querySelectorAll("#popup-avaliacao-media").forEach(el => el.textContent = media.toFixed(1));
  document.querySelectorAll("#popup-avaliacao-total").forEach(el => el.textContent = `(${produto.avaliacoes || 0} avaliações)`);
  const estrelasEl = document.getElementById("popup-estrelas"); if (estrelasEl) estrelasEl.innerHTML = gerarEstrelas(media);

  const antigoEl = document.getElementById("popup-preco-antigo");
  if (antigoEl) { if (produto.precoAntigo) { antigoEl.textContent = produto.precoAntigo; antigoEl.style.display = "block"; } else { antigoEl.textContent = ""; antigoEl.style.display = "none"; } }

  const precoEl = document.getElementById("popup-preco");
  if (precoEl) { precoEl.textContent = produto.preco || ""; precoEl.style.display = produto.preco ? "block" : "none"; }

  // 🔥 PARCELAMENTO: Ícone + "Cartão" + valor (azul) + texto extra (branco)
  const parcelamentoEl = document.getElementById("popup-parcelamento");
  if (parcelamentoEl) {
    if (produto.parcelamento) {
      const extra = produto.textoParcelamento ? ` <span style="color:#fff;font-weight:400">${escaparHTML(produto.textoParcelamento)}</span>` : "";
      parcelamentoEl.innerHTML = `<img src="${ICONES.creditCard}" alt="Cartão" class="icone-parcelamento-azul"> Cartão ${escaparHTML(produto.parcelamento)}${extra}`;
      parcelamentoEl.style.display = "block";
    } else { parcelamentoEl.textContent = ""; parcelamentoEl.style.display = "none"; }
  }

  // 🔥 DESTAQUE ABAIXO DO PARCELAMENTO
  const destaqueEl = document.getElementById("popup-destaque-parcelamento");
  if (destaqueEl) {
    if (produto.textoDestaque) {
      destaqueEl.textContent = produto.textoDestaque;
      destaqueEl.style.display = "block";
    } else { destaqueEl.textContent = ""; destaqueEl.style.display = "none"; }
  }

  renderizarBlocoConfianca();

  const detalhesDiv = document.getElementById("popup-detalhes");
  if (detalhesDiv) { if (produto.detalhes && produto.detalhes.length > 0) { detalhesDiv.innerHTML = `<h3 class="titulo-secao-popup"><img src="${ICONES.clipboardList}" alt="Características" class="icone-titulo-azul"> Características do Produto</h3>`; detalhesDiv.innerHTML += produto.detalhes.map(d => `<p class="linha-icone-js"><img src="${ICONES.circleCheck}" alt="Detalhe" class="icone-js pequeno verde"><span>${escaparHTML(d)}</span></p>`).join(""); detalhesDiv.style.display = "block"; } else { detalhesDiv.innerHTML = ""; detalhesDiv.style.display = "none"; } }

  const btnZap = document.getElementById("popup-whatsapp"); if (btnZap) { btnZap.onclick = () => { registrarCliqueProduto("whatsapp", produto); window.open(`https://wa.me/5575981768068?text=${encodeURIComponent(produto.mensagemWhatsapp || `Olá, quero saber mais sobre ${produto.nome}`)}`, "_blank"); }; }

  window.linkAtualProduto = produto.link || "";
  const btnComprar = document.getElementById("popup-comprar");
  if (btnComprar) { btnComprar.href = produto.link || "#"; btnComprar.innerHTML = `<img src="${ICONES.cart}" alt="Comprar" class="icone-carrinho"> ${escaparHTML(produto.botao || "Comprar agora")}`; btnComprar.onclick = (event) => { event.preventDefault(); registrarCliqueProduto("comprar", produto); if (produto.link) window.open(produto.link, "_blank", "noopener"); }; }

  const descEl = document.getElementById("popup-descricao"); if (descEl) descEl.style.display = "none";
  const obsEl = document.getElementById("popup-observacoes"); if (obsEl) obsEl.style.display = "none";
  const catEl = document.getElementById("popup-categoria"); if (catEl) catEl.style.display = "none";

  mostrarComentariosProduto(produto);
  const box = document.getElementById("popup-comentarios-box"); const btn = document.getElementById("btn-comentarios");
  if (box && btn) { box.classList.remove("ativo"); btn.innerHTML = `<img src="${ICONES.messageSquare}" alt="Comentários" class="icone-js ciano"> Ver comentários`; }

  const popup = document.getElementById("popup-produto"); if (popup) popup.classList.add("ativo");
  const sy = window.scrollY || 0; document.body.dataset.scrollY = String(sy); document.body.classList.add("popup-aberto"); document.body.style.overflow = "hidden"; document.body.style.position = "fixed"; document.body.style.width = "100%"; document.body.style.top = `-${sy}px`;
  renderizarMiniaturas();
}

function fecharPopup() { const sy = Number(document.body.dataset.scrollY || 0); const popup = document.getElementById("popup-produto"); if (popup) popup.classList.remove("ativo"); const vid = document.querySelector("#popup-imagem"); if (vid && vid.tagName === "VIDEO") vid.pause(); document.body.classList.remove("popup-aberto"); document.body.style.overflow = ""; document.body.style.position = ""; document.body.style.width = ""; document.body.style.top = ""; window.scrollTo(0, sy); }
function montarMidiasProduto(p) { return [...(p.imagens || []).map(u => ({ tipo: "imagem", url: u })), ...(p.videos || []).map(u => ({ tipo: "video", url: u }))]; }
function renderizarMidiaPopup(i) { const area = document.querySelector(".popup-imagem-area"); if (!area) return; const t = midiasProdutoAtual.length; const m = midiasProdutoAtual[i]; if (!m) { area.innerHTML = `<div id="popup-imagem" data-imagem-atual="0" style="width:100%;height:320px;display:flex;align-items:center;justify-content:center;color:#94a3b8;background:#020617;">Sem mídia</div><span class="contador-imagem">0/0</span>`; return; } area.innerHTML = m.tipo === "video" ? `<video id="popup-imagem" src="${m.url}" data-imagem-atual="${i}" controls playsinline style="width:100%;height:100%;max-height:460px;object-fit:contain;background:#020617;"></video><span class="contador-imagem">${i+1}/${t}</span>` : `<img id="popup-imagem" src="${m.url}" alt="" data-imagem-atual="${i}" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"><span class="contador-imagem">${i+1}/${t}</span>`; }
function renderizarMiniaturas() { const tc = document.getElementById("popup-thumbs"); if (!tc) return; tc.innerHTML = midiasProdutoAtual.map((m, i) => m.tipo === "video" ? `<button class="popup-thumb ${i===0?"ativa":""}" onclick="atualizarImagem(${i})" style="width:60px;height:60px;border-radius:8px;border:2px solid ${i===0?"#22c55e":"transparent"};background:#020617;color:white;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Vídeo"><img src="${ICONES.play}" alt="Vídeo" class="video-thumb-icon"></button>` : `<img src="${m.url}" class="popup-thumb ${i===0?"ativa":""}" onclick="atualizarImagem(${i})" alt="Miniatura" onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'">`).join(""); }
function atualizarImagem(i) { if (!midiasProdutoAtual.length) return; const v = document.querySelector("#popup-imagem"); if (v && v.tagName === "VIDEO") v.pause(); renderizarMidiaPopup(i); document.querySelectorAll(".popup-thumb").forEach((t, j) => { t.classList.toggle("ativa", j === i); if (t.tagName === "BUTTON") t.style.borderColor = j === i ? "#22c55e" : "transparent"; }); }
function ativarSwipeImagem() { const a = document.querySelector(".popup-imagem-area"); if (!a) return; let sx = 0; a.addEventListener("touchstart", e => { if (e.touches && e.touches.length === 1) sx = e.touches[0].clientX; }, { passive: true }); a.addEventListener("touchend", e => { const ex = e.changedTouches[0].clientX; if (ex < sx - 50) proximaImagemPopup(); if (ex > sx + 50) imagemAnteriorPopup(); }, { passive: true }); }
function proximaImagemPopup() { if (!midiasProdutoAtual.length) return; const el = document.getElementById("popup-imagem"); let a = Number(el?.getAttribute("data-imagem-atual") || 0) + 1; if (a >= midiasProdutoAtual.length) a = 0; atualizarImagem(a); }
function imagemAnteriorPopup() { if (!midiasProdutoAtual.length) return; const el = document.getElementById("popup-imagem"); let a = Number(el?.getAttribute("data-imagem-atual") || 0) - 1; if (a < 0) a = midiasProdutoAtual.length - 1; atualizarImagem(a); }

function mostrarComentariosProduto(produto) { const lista = document.getElementById("popup-lista-comentarios"); const comentarios = produto.comentarios || []; if (!lista) return; if (comentarios.length === 0) { lista.innerHTML = `<p class="sem-comentarios">Nenhum comentário ainda.</p>`; } else { lista.innerHTML = comentarios.map(c => `<div class="comentario-card"><strong>${escaparHTML(c.nome || "Cliente")}</strong><div>${gerarEstrelas(Math.max(1, Math.min(5, Number(c.nota) || 5)))}</div><p>${escaparHTML(c.texto || "")}</p></div>`).join(""); } }
function toggleComentarios() { const box = document.getElementById("popup-comentarios-box"); const btn = document.getElementById("btn-comentarios"); if (!box || !btn) return; const aberto = box.classList.contains("ativo"); box.classList.toggle("ativo", !aberto); btn.innerHTML = aberto ? `<img src="${ICONES.messageSquare}" alt="Comentários" class="icone-js ciano"> Ver comentários` : `<img src="${ICONES.chevronDown}" alt="Ocultar" class="icone-js ciano"> Ocultar comentários`; }
function prepararFormularioComentario() { const form = document.getElementById("form-comentario"); if (!form || form.dataset.listenerAtivo === "sim") return; form.dataset.listenerAtivo = "sim"; form.addEventListener("submit", async function(e) { e.preventDefault(); if (comentarioEnviando) return; comentarioEnviando = true; if (!produtoAtualPopup) { alert("Abra um produto."); comentarioEnviando = false; return; } const btn = form.querySelector("button"); if (btn) { btn.disabled = true; btn.innerHTML = `<img src="${ICONES.send}" alt="Enviando" class="icone-js pequeno ciano"> Enviando...`; } const fd = new FormData(form); const nome = String(fd.get("name") || "").trim(); const texto = String(fd.get("message") || "").trim(); if (!nome || !texto) { alert("Preencha todos os campos."); finalizarEnvioComentario(btn); return; } try { await updateDoc(doc(db, "produtos", produtoAtualPopup.docId), { comentarios: arrayUnion({ id: Date.now() + Math.floor(Math.random() * 999), nome, email: "zyqenstore@gmail.com", texto, nota: Number(fd.get("nota")) || 5, origem: "site", criadoEm: new Date().toISOString() }) }); form.reset(); abrirPopupSucessoComentario(); } catch(erro) { alert("Erro ao enviar."); } finalizarEnvioComentario(btn); }); }
function comentarioJaExiste() { return false; }
function finalizarEnvioComentario(btn) { comentarioEnviando = false; if (btn) { btn.disabled = false; btn.innerHTML = `<img src="${ICONES.send}" alt="Enviar" class="icone-js pequeno ciano"> Enviar comentário`; } }
function abrirPopupSucessoComentario() { const popup = document.getElementById("popup-sucesso-comentario"); if (popup) popup.classList.add("ativo"); }
function fecharPopupSucessoComentario() { const popup = document.getElementById("popup-sucesso-comentario"); if (popup) popup.classList.remove("ativo"); }

function campoClique(tipo) { const m = { comprar: "cliquesComprar", whatsapp: "cliquesWhatsapp", compartilhar: "cliquesCompartilhar", instagram: "cliquesInstagram" }; return m[tipo] || null; }
async function registrarCliqueProduto(tipo, produto = produtoAtualPopup) { if (!produto || !produto.docId) return; const campo = campoClique(tipo); if (!campo) return; const ch = `zyqen_clique_${produto.docId}_${tipo}`; if (cliquesEmAndamento.has(ch)) return; cliquesEmAndamento.add(ch); try { await updateDoc(doc(db, "produtos", produto.docId), { [campo]: increment(1), cliquesTotal: increment(1) }); } catch(erro) {} cliquesEmAndamento.delete(ch); }
function prepararCliquesInstagram() { document.querySelectorAll('a[href*="instagram.com"]').forEach(l => { if (l.dataset.cliqueInstagramAtivo === "sim") return; l.dataset.cliqueInstagramAtivo = "sim"; l.addEventListener("click", () => { if (produtoAtualPopup) registrarCliqueProduto("instagram", produtoAtualPopup); }); }); }
function compartilharProduto() { if (produtoAtualPopup) registrarCliqueProduto("compartilhar", produtoAtualPopup); if (navigator.share) navigator.share({ title: produtoAtualPopup?.nome || "Zyqen Store", url: window.linkAtualProduto }); else { navigator.clipboard.writeText(window.linkAtualProduto || ""); alert("Link copiado!"); } }

function injetarEstiloBuscaInteligente() { if (document.getElementById("css-busca-inteligente-zyqen")) return; const s = document.createElement("style"); s.id = "css-busca-inteligente-zyqen"; s.innerHTML = `.busca-inteligente-painel{width:min(94%,1120px);margin:18px auto 26px;padding:18px;border:1px solid rgba(148,163,184,.22);border-radius:24px;background:radial-gradient(circle at top left,rgba(34,211,238,.12),transparent 35%),radial-gradient(circle at top right,rgba(34,197,94,.10),transparent 35%),rgba(15,23,42,.70);box-shadow:0 18px 55px rgba(0,0,0,.28);backdrop-filter:blur(10px)}.busca-inteligente-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.busca-inteligente-topo strong{display:block;color:#f8fafc;font-size:16px;letter-spacing:.2px}.busca-inteligente-topo span{display:block;margin-top:3px;color:#94a3b8;font-size:13px;line-height:1.35}.busca-linha-superior{display:grid;grid-template-columns:minmax(260px,1fr) 300px;gap:12px;align-items:center}.campo-pesquisa-organizado{position:relative;width:100%}.campo-pesquisa-organizado img{position:absolute;left:15px;top:50%;transform:translateY(-50%);width:18px;height:18px;opacity:.74;pointer-events:none;filter:invert(78%)sepia(59%)saturate(1324%)hue-rotate(147deg)brightness(98%)contrast(94%);z-index:2}#pesquisa.pesquisa-organizada-js{width:100%!important;max-width:100%!important;min-height:48px!important;margin:0!important;padding:0 16px 0 46px!important;border:1px solid rgba(148,163,184,.28)!important;border-radius:16px!important;background:rgba(2,6,23,.62)!important;color:#f8fafc!important;outline:none!important;font-weight:600!important;font-size:16px!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 12px 26px rgba(0,0,0,.18)!important}#pesquisa.pesquisa-organizada-js:focus{border-color:rgba(34,211,238,.85)!important;box-shadow:0 0 0 3px rgba(34,211,238,.14),0 12px 26px rgba(0,0,0,.18)!important}#ordenarProdutos{min-height:48px;padding:0 14px;width:100%;border:1px solid rgba(148,163,184,.28);border-radius:16px;background:rgba(2,6,23,.62);color:#f8fafc;font-weight:800;font-size:16px;box-shadow:0 12px 26px rgba(0,0,0,.18)}.filtros-rapidos-busca button,#botoes-filtro button{border:1px solid rgba(148,163,184,.25)!important;border-radius:999px!important;padding:10px 14px!important;background:rgba(15,23,42,.86)!important;color:#e2e8f0!important;cursor:pointer!important;font-weight:900!important;transition:.2s!important}.filtros-rapidos-busca button.ativo,#botoes-filtro button.ativo{background:linear-gradient(90deg,#22c55e,#22d3ee)!important;color:#04111f!important;border-color:transparent!important;transform:translateY(-1px)}@media(max-width:720px){.busca-inteligente-painel{width:calc(100% - 20px);padding:14px;border-radius:20px}.busca-linha-superior{grid-template-columns:1fr}.filtros-rapidos-busca button,#botoes-filtro button{font-size:12px!important;padding:9px 11px!important}}`; document.head.appendChild(s); }
function injetarEstiloIconesJS() { if (document.getElementById("css-icones-js-zyqen")) return; const s = document.createElement("style"); s.id = "css-icones-js-zyqen"; s.innerHTML = `.icone-js{width:18px;height:18px;object-fit:contain;flex-shrink:0;filter:brightness(0)invert(1)}.icone-js.pequeno{width:15px;height:15px}.icone-js.verde{filter:invert(57%)sepia(85%)saturate(495%)hue-rotate(88deg)brightness(95%)contrast(88%)}.icone-js.amarelo{filter:invert(86%)sepia(84%)saturate(872%)hue-rotate(356deg)brightness(103%)contrast(96%)}.icone-js.ciano{filter:invert(78%)sepia(59%)saturate(1324%)hue-rotate(147deg)brightness(98%)contrast(94%)}.linha-icone-js{display:flex;align-items:flex-start;gap:8px}.estrelas-icone{display:inline-flex;align-items:center;gap:2px}.estrelas-icone img{width:15px;height:15px}.estrelas-icone img.estrela-cheia{filter:drop-shadow(0 0 5px rgba(250,204,21,.35))}.estrelas-icone img.estrela-vazia{opacity:.42;filter:invert(63%)sepia(11%)saturate(564%)hue-rotate(176deg)brightness(92%)contrast(84%)}.btn-ver-comentarios img{width:18px;height:18px;filter:invert(78%)sepia(59%)saturate(1324%)hue-rotate(147deg)brightness(98%)contrast(94%)}.video-thumb-icon{width:24px;height:24px;filter:invert(56%)sepia(77%)saturate(2100%)hue-rotate(226deg)brightness(96%)contrast(96%)}`; document.head.appendChild(s); }
function injetarEstiloPaginacao() { if (document.getElementById("css-paginacao-zyqen")) return; const s = document.createElement("style"); s.id = "css-paginacao-zyqen"; s.innerHTML = `.paginacao-loja{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:20px 12px 28px}.paginacao-loja button{min-width:40px;height:40px;padding:0 12px;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:rgba(15,23,42,.85);color:#fff;cursor:pointer;font-weight:800;transition:.2s}.paginacao-loja button.ativo{background:linear-gradient(90deg,#22d3ee,#8b5cf6,#ff2fb3);border-color:transparent;box-shadow:0 8px 25px rgba(139,92,246,.25)}.paginacao-loja button:disabled{opacity:.45;cursor:not-allowed}.paginacao-info{width:100%;text-align:center;color:#94a3b8;font-size:13px}`; document.head.appendChild(s); }

function gerarEstrelas(avaliacao) { let h = `<span class="estrelas-icone">`; const n = Math.floor(Number(avaliacao) || 0); for (let i = 0; i < 5; i++) { const c = i < n; h += `<img src="${c ? ICONES.starCheia : ICONES.star}" class="${c ? "estrela-cheia" : "estrela-vazia"}" alt="${c ? "Estrela" : "Vazia"}" onerror="this.style.display='none'">`; } return h + `</span>`; }
function normalizarTexto(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function slugify(t) { return normalizarTexto(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function numeroPreco(v) { let t = String(v || "").replace("R$", "").replace(/\s/g, "").replace(/[^\d.,]/g, ""); if (!t) return 0; if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", "."); else if (t.includes(",")) t = t.replace(",", "."); return Number(t) || 0; }
function precoProduto(p) { return numeroPreco(p.preco || p.precoAtual || p.valor || 0); }
function dataProduto(p) { for (const c of [p.criadoEm, p.createdAt, p.dataCriacao, p.atualizadoEm, p.updatedAt]) { if (!c) continue; if (typeof c?.toDate === "function") { const t = c.toDate().getTime(); if (!Number.isNaN(t)) return t; } const t = new Date(c).getTime(); if (!Number.isNaN(t)) return t; } return 0; }
function textoBuscaProduto(p) { return normalizarTexto(`${p.nome||""} ${p.categoria||""} ${p.descricao||""} ${p.preco||""} ${p.selo||""} ${(p.detalhes||[]).join(" ")} ${(p.observacoes||[]).join(" ")}`); }
function escaparHTML(t) { return String(t || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function escaparJS(t) { return String(t || "").replaceAll("\\","\\\\").replaceAll("'","\\'").replaceAll('"',"&quot;"); }

window.abrirPopupProduto = abrirPopupProduto;
window.fecharPopup = fecharPopup;
window.compartilharProduto = compartilharProduto;
window.atualizarImagem = atualizarImagem;
window.filtrarCategoria = filtrarCategoria;
window.filtrarRapido = filtrarRapido;
window.toggleComentarios = toggleComentarios;
window.trocarPaginaProdutos = trocarPaginaProdutos;
window.abrirPopupSucessoComentario = abrirPopupSucessoComentario;
window.fecharPopupSucessoComentario = fecharPopupSucessoComentario;
window.bloquearZoomSite = bloquearZoomSite;
window.atualizarAreaDestaque = atualizarAreaDestaque;