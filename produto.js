import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* =========================================================
   ZYQEN STORE - PÁGINA DO PRODUTO
   produto.html?id=ID_DO_PRODUTO

   Esse arquivo:
   - pega o ID do produto pela URL
   - busca o produto no Firebase
   - mantém o produto aberto mesmo atualizando a página
   - carrega imagens, miniaturas, preço, parcelamento,
     barrinha do parceiro, detalhes, comentários e recomendados
   - melhora a versão mobile da página do produto
========================================================= */

let listaProdutos = [];
let listaFaixasParceiros = [];
let produtoAtual = null;
let midiasProdutoAtual = [];
let indiceMidiaAtual = 0;
let cliquesEmAndamento = new Set();
let comentarioEnviando = false;

let bloqueioTrocaImagem = false;
let rafGaleria = null;
let rafResize = null;

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

const NOMES_PUBLICOS_PLATAFORMA = {
  shopee: "Parceiro A",
  "mercado-livre": "Parceiro B",
  mercadolivre: "Parceiro B",
  cakto: "Digital",
  digital: "Digital"
};

/* =========================================================
   INICIAR
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  detectarProdutoPageDispositivo();
  bloquearZoomBasico();
  prepararBotoesFixos();
  prepararSwipeImagem();
  prepararFormularioComentarioProdutoPage();
  prepararVerMaisDetalhes();
  carregarPaginaProduto();

  window.addEventListener("resize", agendarResizeProdutoPage, { passive: true });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      detectarProdutoPageDispositivo();
      agendarAjusteGaleria();
    }, 220);
  });
});

/* =========================================================
   CARREGAR DADOS
========================================================= */

async function carregarPaginaProduto() {
  const idProduto = pegarIdDaURL();

  if (!idProduto) {
    mostrarErroProduto();
    return;
  }

  mostrarLoadingProduto();

  try {
    await Promise.all([
      carregarFaixasParceiros(),
      carregarProdutos()
    ]);

    const produto = encontrarProdutoPorId(idProduto);

    if (!produto) {
      mostrarErroProduto();
      return;
    }

    produtoAtual = produto;
    midiasProdutoAtual = montarMidiasProduto(produtoAtual);
    indiceMidiaAtual = 0;

    renderizarProduto(produtoAtual);
    esconderLoadingProduto();
    mostrarProduto();

    setTimeout(() => {
      agendarAjusteGaleria();
      iniciarModoMobileDetalhes();
    }, 80);
  } catch (erro) {
    console.warn("Erro ao carregar página do produto:", erro);
    mostrarErroProduto();
  }
}

async function carregarProdutos() {
  const snapshot = await getDocs(collection(db, "produtos"));

  listaProdutos = snapshot.docs
    .map(documento => normalizarProduto({ docId: documento.id, ...documento.data() }))
    .filter(produto => produto.ativo !== false)
    .sort((a, b) => {
      const ordemA = Number(a.ordem) || 999;
      const ordemB = Number(b.ordem) || 999;

      if (ordemA !== ordemB) return ordemA - ordemB;
      if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;

      return dataProduto(b) - dataProduto(a);
    });
}

async function carregarFaixasParceiros() {
  try {
    const snapshot = await getDocs(collection(db, "faixasParceiros"));

    listaFaixasParceiros = snapshot.docs
      .map(documento => normalizarFaixaParceiro({ docId: documento.id, ...documento.data() }))
      .filter(faixa => faixa.ativo !== false)
      .sort((a, b) => (Number(a.ordem) || 999) - (Number(b.ordem) || 999));
  } catch (erro) {
    console.warn("Não foi possível carregar faixas dos parceiros:", erro);
    listaFaixasParceiros = [];
  }
}

function encontrarProdutoPorId(idProduto) {
  const idLimpo = String(idProduto || "").trim();

  return (
    listaProdutos.find(produto => String(produto.docId) === idLimpo) ||
    listaProdutos.find(produto => String(produto.id) === idLimpo)
  );
}

function pegarIdDaURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || params.get("produto") || "";
}

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

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

    faixaParceiroId: String(
      p.faixaParceiroId || p.faixaId || p.barrinhaParceiroId || ""
    ).trim(),

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

function normalizarFaixaParceiro(faixa) {
  const nome = String(faixa.nome || faixa.titulo || "Barrinha").trim();
  const slug = String(faixa.slug || faixa.id || faixa.docId || slugify(nome)).trim();
  const opacidadeNumero = Number(faixa.opacidade);

  return {
    ...faixa,
    docId: faixa.docId || slug,
    nome,
    slug,
    cor: String(faixa.cor || faixa.color || "#b98a37").trim(),
    opacidade: Number.isFinite(opacidadeNumero)
      ? Math.max(0.05, Math.min(1, opacidadeNumero))
      : 0.18,
    ordem: Number(faixa.ordem) || 999,
    ativo: faixa.ativo !== false
  };
}

/* =========================================================
   RENDERIZAR PRODUTO
========================================================= */

function renderizarProduto(produto) {
  document.title = `${produto.nome} - Zyqen Store`;

  atualizarMetaDescription(produto);
  definirTexto("produto-categoria", categoriaPublicaDoProduto(produto));
  definirTexto("produto-nome", produto.nome);
  definirTexto("produto-preco", produto.preco || "Ver preço na loja");
  definirTexto(
    "produto-descricao",
    produto.descricao || "Produto selecionado pela Zyqen Store. Confira todos os detalhes na plataforma oficial."
  );

  renderizarPrecoAntigo(produto);
  renderizarAvaliacao(produto);
  renderizarParcelamento(produto);
  renderizarFaixaParceiro(produto);
  renderizarDestaqueParcelamento(produto);
  renderizarGaleriaProduto();
  renderizarConfianca();
  renderizarDetalhes(produto);
  renderizarObservacoes(produto);
  renderizarComentarios(produto);
  renderizarRecomendados(produto);
  configurarBotaoComprar(produto);
}

function atualizarMetaDescription(produto) {
  const meta = document.querySelector("meta[name='description']");
  if (!meta) return;

  const descricao = produto.descricao
    ? cortarTexto(produto.descricao, 150)
    : `Veja detalhes de ${produto.nome} na Zyqen Store.`;

  meta.setAttribute("content", descricao);
}

function renderizarPrecoAntigo(produto) {
  const el = document.getElementById("produto-preco-antigo");
  if (!el) return;

  if (produto.precoAntigo) {
    el.textContent = produto.precoAntigo;
    el.style.display = "inline";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

function renderizarAvaliacao(produto) {
  const media = document.getElementById("produto-avaliacao-media");
  const estrelas = document.getElementById("produto-estrelas");
  const total = document.getElementById("produto-avaliacao-total");

  const avaliacao = Number(produto.avaliacao) || 0;
  const avaliacoes = Number(produto.avaliacoes) || produto.comentarios.length || 0;

  if (media) {
    media.textContent = avaliacao ? avaliacao.toFixed(1).replace(".", ",") : "Novo";
  }

  if (estrelas) {
    estrelas.innerHTML = gerarEstrelas(avaliacao || 5);
  }

  if (total) {
    total.textContent = avaliacoes ? `(${avaliacoes} avaliações)` : "Sem avaliações ainda";
  }
}

function renderizarParcelamento(produto) {
  const el = document.getElementById("produto-parcelamento");
  if (!el) return;

  if (!produto.parcelamento) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }

  el.innerHTML = `${escaparHTML(produto.parcelamento)}${
    produto.textoParcelamento ? ` <b>${escaparHTML(produto.textoParcelamento)}</b>` : ""
  }`;

  el.style.display = "inline-flex";
}

function renderizarDestaqueParcelamento(produto) {
  const el = document.getElementById("produto-destaque-parcelamento");
  if (!el) return;

  const texto = produto.textoDestaque || produto.urgencia || "";

  el.textContent = texto;
  el.style.display = texto ? "block" : "none";
}

function configurarBotaoComprar(produto) {
  const botao = document.getElementById("produto-comprar-link");
  if (!botao) return;

  botao.href = produto.link || "#";
  botao.textContent = produto.botao || "Comprar agora";

  botao.onclick = () => {
    registrarCliqueProduto("comprar", produto);
  };
}

/* =========================================================
   BARRINHA DO PARCEIRO
========================================================= */

function renderizarFaixaParceiro(produto) {
  const el = document.getElementById("produto-faixa-parceiro");
  if (!el) return;

  const faixa = faixaParceiroDoProduto(produto);

  if (!faixa) {
    el.textContent = "";
    el.removeAttribute("style");
    el.style.setProperty("display", "none", "important");
    return;
  }

  const cor = faixa.cor || "#b98a37";
  const opacidade = Number(faixa.opacidade) || 0.18;
  const ehMobile = window.innerWidth <= 680;

  el.textContent = faixa.nome;

  el.style.setProperty("display", "inline-flex", "important");
  el.style.setProperty("background", corComOpacidade(cor, opacidade), "important");
  el.style.setProperty(
    "border-color",
    corComOpacidade(cor, Math.min(0.95, opacidade + 0.32)),
    "important"
  );

  el.style.setProperty("color", "#111111", "important");
  el.style.setProperty("font-size", ehMobile ? "12px" : "13px", "important");
  el.style.setProperty("font-weight", "950", "important");
  el.style.setProperty("letter-spacing", "0.01em", "important");
  el.style.setProperty("min-height", ehMobile ? "28px" : "31px", "important");
  el.style.setProperty("padding", ehMobile ? "6px 12px" : "7px 14px", "important");
  el.style.setProperty("box-shadow", `0 8px 22px ${corComOpacidade(cor, 0.12)}`, "important");
}

function faixaParceiroDoProduto(produto) {
  const id = String(produto?.faixaParceiroId || "").trim();

  if (!id) return null;

  const todasFaixas = listaFaixasParceiros.length
    ? listaFaixasParceiros
    : FAIXAS_PARCEIROS_PADRAO.map(normalizarFaixaParceiro);

  return (
    todasFaixas.find(faixa => String(faixa.slug) === id) ||
    todasFaixas.find(faixa => String(faixa.docId) === id) ||
    todasFaixas.find(faixa => String(faixa.nome) === id) ||
    null
  );
}

/* =========================================================
   GALERIA
========================================================= */

function montarMidiasProduto(produto) {
  const imagens = Array.isArray(produto.imagens)
    ? produto.imagens.filter(Boolean).map(src => ({ tipo: "imagem", src }))
    : [];

  const videos = Array.isArray(produto.videos)
    ? produto.videos.filter(Boolean).map(src => ({ tipo: "video", src }))
    : [];

  const midias = [...imagens, ...videos];

  if (!midias.length) {
    midias.push({ tipo: "imagem", src: IMAGEM_FALLBACK });
  }

  return midias;
}

function renderizarGaleriaProduto() {
  renderizarMidiaAtual(0);
  renderizarMiniaturas();
}

function renderizarMidiaAtual(indice = 0) {
  if (!midiasProdutoAtual.length) return;

  const imagem = document.getElementById("produto-imagem-principal");
  const contador = document.getElementById("produto-contador-imagem");

  if (!imagem) return;

  indiceMidiaAtual = Math.max(0, Math.min(Number(indice) || 0, midiasProdutoAtual.length - 1));

  const midia = midiasProdutoAtual[indiceMidiaAtual];

  imagem.decoding = "async";
  imagem.loading = "eager";

  if (midia.tipo === "imagem") {
    imagem.src = midia.src || IMAGEM_FALLBACK;
    imagem.alt = produtoAtual?.nome || "Produto";
    imagem.style.display = "block";

    imagem.onload = () => {
      agendarAjusteGaleria();
    };

    imagem.onerror = () => {
      imagem.onerror = null;
      imagem.src = IMAGEM_FALLBACK;
      agendarAjusteGaleria();
    };
  }

  if (contador) {
    contador.textContent = `${indiceMidiaAtual + 1}/${midiasProdutoAtual.length}`;
  }

  document.querySelectorAll(".produto-page-thumb").forEach((thumb, index) => {
    thumb.classList.toggle("ativo", index === indiceMidiaAtual);
  });

  agendarAjusteGaleria();
}

function renderizarMiniaturas() {
  const box = document.getElementById("produto-miniaturas");
  if (!box) return;

  box.innerHTML = midiasProdutoAtual
    .map((midia, index) => {
      const preview = midia.tipo === "imagem" ? midia.src : IMAGEM_FALLBACK;

      return `
        <button
          type="button"
          class="produto-page-thumb ${index === indiceMidiaAtual ? "ativo" : ""}"
          data-thumb-index="${index}"
          aria-label="Imagem ${index + 1}"
        >
          <img
            src="${escaparHTML(preview)}"
            alt="Miniatura ${index + 1}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"
          >
        </button>
      `;
    })
    .join("");

  box.querySelectorAll("[data-thumb-index]").forEach(botao => {
    botao.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        const index = Number(botao.dataset.thumbIndex) || 0;
        trocarImagemPara(index);
      },
      { passive: false }
    );
  });
}

function trocarImagemPara(index) {
  if (bloqueioTrocaImagem) return;

  bloqueioTrocaImagem = true;
  renderizarMidiaAtual(index);

  setTimeout(() => {
    bloqueioTrocaImagem = false;
  }, 180);
}

function proximaImagem() {
  const total = Math.max(1, midiasProdutoAtual.length);
  const proxima = (indiceMidiaAtual + 1) % total;
  trocarImagemPara(proxima);
}

function imagemAnterior() {
  const total = Math.max(1, midiasProdutoAtual.length);
  const anterior = (indiceMidiaAtual - 1 + total) % total;
  trocarImagemPara(anterior);
}

function agendarAjusteGaleria() {
  const area = document.querySelector(".produto-page-imagem-area");
  const imagem = document.getElementById("produto-imagem-principal");

  if (!area || !imagem) return;

  const ehMobile = window.innerWidth <= 680;

  imagem.style.setProperty("object-fit", "contain", "important");
  imagem.style.setProperty("object-position", "center center", "important");
  imagem.style.setProperty("padding", "0", "important");
  imagem.style.setProperty("margin", "0 auto", "important");
  imagem.style.setProperty("background", "#ffffff", "important");
  imagem.style.setProperty("transform", "none", "important");

  if (ehMobile) {
    area.style.setProperty("height", "auto", "important");
    area.style.setProperty("min-height", "0", "important");
    area.style.setProperty("max-height", "none", "important");
    area.style.setProperty("aspect-ratio", "auto", "important");
    area.style.setProperty("overflow", "hidden", "important");
    area.style.setProperty("display", "block", "important");

    imagem.style.setProperty("width", "100%", "important");
    imagem.style.setProperty("height", "auto", "important");
    imagem.style.setProperty("max-width", "100%", "important");
    imagem.style.setProperty("max-height", "none", "important");
    imagem.style.setProperty("display", "block", "important");
    return;
  }

  area.style.removeProperty("height");
  area.style.removeProperty("min-height");
  area.style.removeProperty("max-height");

  imagem.style.setProperty("width", "100%", "important");
  imagem.style.setProperty("height", "100%", "important");
  imagem.style.setProperty("max-width", "100%", "important");
  imagem.style.setProperty("max-height", "100%", "important");
}


function prepararSwipeImagem() {
  let inicioX = 0;
  let inicioY = 0;
  let tocouImagem = false;

  document.addEventListener(
    "touchstart",
    event => {
      const area = event.target.closest?.(".produto-page-imagem-area");
      if (!area) return;

      tocouImagem = true;
      inicioX = event.touches[0].clientX;
      inicioY = event.touches[0].clientY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    event => {
      if (!tocouImagem) return;

      const area = event.target.closest?.(".produto-page-imagem-area");
      tocouImagem = false;

      if (!area) return;

      const fimX = event.changedTouches[0].clientX;
      const fimY = event.changedTouches[0].clientY;

      const dx = fimX - inicioX;
      const dy = fimY - inicioY;

      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        if (dx < 0) proximaImagem();
        else imagemAnterior();
      }
    },
    { passive: true }
  );
}

/* =========================================================
   CONFIANÇA / DETALHES / COMENTÁRIOS
========================================================= */

function renderizarConfianca() {
  const box = document.getElementById("produto-confianca");
  if (!box) return;

  box.innerHTML = `
    <div class="produto-page-confianca-grid">
      <div class="produto-page-confianca-item">
        <span>✓</span>
        <div>
          <strong>Compra na plataforma</strong>
          <p>Você finaliza a compra direto na loja parceira.</p>
        </div>
      </div>

      <div class="produto-page-confianca-item">
        <span>
          <img src="imagens/icones/lock.svg" alt="">
        </span>
        <div>
          <strong>Sem pagamento no site</strong>
          <p>A Zyqen Store não coleta cartão, senha ou dados bancários.</p>
        </div>
      </div>

      <div class="produto-page-confianca-item">
        <span>★</span>
        <div>
          <strong>Produto selecionado</strong>
          <p>Produto organizado para facilitar sua escolha.</p>
        </div>
      </div>
    </div>
  `;
}

function renderizarDetalhes(produto) {
  const box = document.getElementById("produto-detalhes-box");
  if (!box) return;

  const detalhes = Array.isArray(produto.detalhes) ? produto.detalhes.filter(Boolean) : [];

  box.innerHTML = `
    <div class="produto-page-card-bloco produto-page-detalhes-card">
      <div class="produto-page-detalhes-head">
        <h2>Características do Produto</h2>
      </div>

      <div id="produto-page-detalhes-conteudo" class="produto-page-detalhes-conteudo reduzido">
        ${
          detalhes.length
            ? `<ul>${detalhes.map(item => `<li>${formatarDetalhe(item)}</li>`).join("")}</ul>`
            : `<p>As principais informações estão na descrição e na página oficial da oferta.</p>`
        }
      </div>

      ${
        detalhes.length > 4
          ? `<button type="button" id="produto-page-ver-mais-detalhes" class="produto-page-ver-mais-detalhes" data-aberto="false">Ver mais</button>`
          : ""
      }
    </div>
  `;

  setTimeout(iniciarModoMobileDetalhes, 50);
}

function prepararVerMaisDetalhes() {
  document.addEventListener("click", event => {
    const botao = event.target.closest?.("#produto-page-ver-mais-detalhes");
    if (!botao) return;

    event.preventDefault();

    const conteudo = document.getElementById("produto-page-detalhes-conteudo");
    if (!conteudo) return;

    const aberto = botao.dataset.aberto === "true";

    if (aberto) {
      conteudo.classList.add("reduzido");
      botao.dataset.aberto = "false";
      botao.textContent = "Ver mais";
    } else {
      conteudo.classList.remove("reduzido");
      botao.dataset.aberto = "true";
      botao.textContent = "Ver menos";
    }
  });
}

function iniciarModoMobileDetalhes() {
  const conteudo = document.getElementById("produto-page-detalhes-conteudo");
  const botao = document.getElementById("produto-page-ver-mais-detalhes");

  if (!conteudo || !botao) return;

  const ehMobile = window.innerWidth <= 680;

  if (ehMobile) {
    conteudo.classList.add("reduzido");
    botao.dataset.aberto = "false";
    botao.textContent = "Ver mais";
    botao.style.display = "inline-flex";
  } else {
    conteudo.classList.remove("reduzido");
    botao.dataset.aberto = "true";
    botao.textContent = "Ver menos";
    botao.style.display = "none";
  }
}

function renderizarObservacoes(produto) {
  const box = document.getElementById("produto-observacoes-box");
  if (!box) return;

  const observacoes = Array.isArray(produto.observacoes)
    ? produto.observacoes.filter(Boolean)
    : [];

  if (!observacoes.length) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }

  box.hidden = false;

  box.innerHTML = `
    <div class="produto-page-card-bloco">
      <h2>Observações</h2>

      <ul>
        ${observacoes
          .map(item => {
            const texto =
              typeof item === "string"
                ? item
                : item.texto || item.descricao || item.valor || "";

            return `<li>${escaparHTML(texto)}</li>`;
          })
          .join("")}
      </ul>
    </div>
  `;
}

function renderizarComentarios(produto) {
  const box = document.getElementById("produto-comentarios-box");
  if (!box) return;

  const comentarios = Array.isArray(produto.comentarios) ? produto.comentarios : [];

  box.innerHTML = `
    <div class="produto-page-card-bloco produto-page-comentarios-card">
      <div class="produto-page-comentarios-topo">
        <h2>Comentários</h2>
        <span>${comentarios.length || 0}</span>
      </div>

      <div class="produto-page-comentarios-lista">
        ${
          comentarios.length
            ? comentarios
                .slice()
                .reverse()
                .map(comentario => criarComentarioHTML(comentario))
                .join("")
            : `<p class="produto-page-vazio">Ainda não há comentários para este produto.</p>`
        }
      </div>

      <form id="produto-page-form-comentario" class="produto-page-form-comentario">
        <h3>Enviar comentário</h3>

        <div class="produto-page-form-grid">
          <input
            type="text"
            id="produto-page-comentario-nome"
            placeholder="Seu nome"
            maxlength="40"
            required
          >

          <select id="produto-page-comentario-nota" required>
            <option value="5">5 estrelas</option>
            <option value="4">4 estrelas</option>
            <option value="3">3 estrelas</option>
            <option value="2">2 estrelas</option>
            <option value="1">1 estrela</option>
          </select>
        </div>

        <textarea
          id="produto-page-comentario-texto"
          placeholder="Escreva seu comentário sobre o produto..."
          maxlength="240"
          required
        ></textarea>

        <button type="submit">Enviar comentário</button>

        <p id="produto-page-comentario-status" class="produto-page-comentario-status"></p>
      </form>
    </div>
  `;
}

function prepararFormularioComentarioProdutoPage() {
  document.addEventListener("submit", async event => {
    const form = event.target.closest?.("#produto-page-form-comentario");
    if (!form) return;

    event.preventDefault();

    if (comentarioEnviando || !produtoAtual?.docId) return;

    const nome = document.getElementById("produto-page-comentario-nome")?.value.trim();
    const texto = document.getElementById("produto-page-comentario-texto")?.value.trim();
    const nota = Number(document.getElementById("produto-page-comentario-nota")?.value || 5);
    const botao = form.querySelector("button[type='submit']");
    const status = document.getElementById("produto-page-comentario-status");

    if (!nome || !texto) {
      if (status) {
        status.textContent = "Preencha seu nome e comentário.";
        status.classList.add("erro");
      }
      return;
    }

    comentarioEnviando = true;

    if (botao) {
      botao.disabled = true;
      botao.textContent = "Enviando...";
    }

    if (status) {
      status.textContent = "Enviando comentário...";
      status.classList.remove("erro");
      status.classList.remove("sucesso");
    }

    const novoComentario = {
      nome,
      texto,
      nota,
      tipo: "real",
      data: new Date().toISOString()
    };

    try {
      const ref = doc(db, "produtos", produtoAtual.docId);

      await updateDoc(ref, {
        comentarios: arrayUnion(novoComentario)
      });

      produtoAtual.comentarios = [
        ...(Array.isArray(produtoAtual.comentarios) ? produtoAtual.comentarios : []),
        novoComentario
      ];

      const produtoNaLista = listaProdutos.find(
        item => String(item.docId) === String(produtoAtual.docId)
      );

      if (produtoNaLista) {
        produtoNaLista.comentarios = produtoAtual.comentarios;
      }

      form.reset();
      renderizarComentarios(produtoAtual);

      const novoStatus = document.getElementById("produto-page-comentario-status");
      if (novoStatus) {
        novoStatus.textContent = "Comentário enviado com sucesso!";
        novoStatus.classList.add("sucesso");
      }
    } catch (erro) {
      console.warn("Erro ao enviar comentário:", erro);

      if (status) {
        status.textContent = "Não foi possível enviar o comentário agora.";
        status.classList.add("erro");
      } else {
        alert("Não foi possível enviar o comentário agora.");
      }
    } finally {
      comentarioEnviando = false;

      const novoBotao = document.querySelector("#produto-page-form-comentario button[type='submit']");
      if (novoBotao) {
        novoBotao.disabled = false;
        novoBotao.textContent = "Enviar comentário";
      }
    }
  });
}

function criarComentarioHTML(comentario) {
  const nome = comentario.nome || comentario.autor || "Cliente";
  const texto = comentario.texto || comentario.comentario || "";
  const nota = Number(comentario.nota || comentario.avaliacao || 5);

  return `
    <article class="produto-page-comentario">
      <div>
        <strong>${escaparHTML(nome)}</strong>
        <span>${gerarEstrelas(nota)}</span>
      </div>
      <p>${escaparHTML(texto)}</p>
    </article>
  `;
}

function formatarDetalhe(item) {
  if (typeof item === "string") return escaparHTML(item);

  const nome = item.nome || item.titulo || item.chave || "Detalhe";
  const valor = item.valor || item.texto || item.descricao || "";

  return `<strong>${escaparHTML(nome)}:</strong> ${escaparHTML(valor)}`;
}

/* =========================================================
   RECOMENDADOS
========================================================= */

function renderizarRecomendados(produto) {
  const grid = document.getElementById("produto-recomendados-grid");
  if (!grid) return;

  const idAtual = String(produto.id || produto.docId);

  const recomendados = listaProdutos
    .filter(item => String(item.id || item.docId) !== idAtual)
    .sort((a, b) => {
      const mesmoDepartamentoA = a.departamentoSlug === produto.departamentoSlug ? 0 : 1;
      const mesmoDepartamentoB = b.departamentoSlug === produto.departamentoSlug ? 0 : 1;

      if (mesmoDepartamentoA !== mesmoDepartamentoB) {
        return mesmoDepartamentoA - mesmoDepartamentoB;
      }

      if (a.destaque !== b.destaque) {
        return a.destaque ? -1 : 1;
      }

      return Number(b.avaliacao) - Number(a.avaliacao);
    })
    .slice(0, 8);

  if (!recomendados.length) {
    grid.innerHTML = `
      <div class="produto-page-vazio produto-page-vazio-recomendados">
        Nenhum outro produto disponível no momento.
      </div>
    `;
    return;
  }

  grid.innerHTML = recomendados.map(criarCardRecomendado).join("");
}

function criarCardRecomendado(produto) {
  const id = produto.id || produto.docId;

  return `
    <a class="produto-page-recomendado-card" href="produto.html?id=${encodeURIComponent(id)}">
      <div>
        <img
          src="${escaparHTML(imagemPrincipal(produto))}"
          alt="${escaparHTML(produto.nome)}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"
        >
      </div>

      <section>
        <span>${escaparHTML(categoriaPublicaDoProduto(produto))}</span>
        <h3>${escaparHTML(produto.nome)}</h3>
        <strong>${escaparHTML(produto.preco || "Ver preço")}</strong>
      </section>
    </a>
  `;
}

/* =========================================================
   BOTÕES
========================================================= */

function prepararBotoesFixos() {
  const voltar = document.getElementById("produto-voltar");
  const compartilhar = document.getElementById("produto-compartilhar");
  const anterior = document.getElementById("produto-img-anterior");
  const proxima = document.getElementById("produto-img-proxima");
  const busca = document.getElementById("produto-page-busca");

  if (voltar) {
    voltar.addEventListener("click", event => {
      event.preventDefault();

      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "index.html";
      }
    });
  }

  if (compartilhar) {
    compartilhar.addEventListener("click", event => {
      event.preventDefault();
      compartilharProduto();
    });
  }

  if (anterior) {
    anterior.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      imagemAnterior();
    });
  }

  if (proxima) {
    proxima.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      proximaImagem();
    });
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
}

function agendarResizeProdutoPage() {
  if (rafResize) {
    cancelAnimationFrame(rafResize);
  }

  rafResize = requestAnimationFrame(() => {
    rafResize = null;

    detectarProdutoPageDispositivo();
    agendarAjusteGaleria();

    if (produtoAtual) {
      renderizarFaixaParceiro(produtoAtual);
      iniciarModoMobileDetalhes();
    }
  });
}

async function compartilharProduto() {
  if (!produtoAtual) return;

  registrarCliqueProduto("compartilhar", produtoAtual);

  const url = window.location.href;
  const texto = `${produtoAtual.nome} - ${produtoAtual.preco || "Produto Zyqen Store"}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: produtoAtual.nome,
        text: texto,
        url
      });

      return;
    } catch (_) {}
  }

  try {
    await navigator.clipboard.writeText(url);
    alert("Link do produto copiado!");
  } catch (_) {
    prompt("Copie o link do produto:", url);
  }
}

function abrirWhatsappProduto() {
  if (!produtoAtual) return;

  registrarCliqueProduto("whatsapp", produtoAtual);

  const mensagem =
    produtoAtual.mensagemWhatsapp ||
    `Olá, vim pelo site Zyqen Store e quero saber mais sobre: ${produtoAtual.nome}`;

  window.open(
    `https://wa.me/${TELEFONE_WHATSAPP}?text=${encodeURIComponent(mensagem)}`,
    "_blank",
    "noopener"
  );
}

/* =========================================================
   CLIQUES FIREBASE
========================================================= */

async function registrarCliqueProduto(tipo, produto = produtoAtual) {
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
    console.warn("Clique não registrado:", erro);
  } finally {
    setTimeout(() => cliquesEmAndamento.delete(chave), 700);
  }
}

/* =========================================================
   LOADING / ERRO
========================================================= */

function mostrarLoadingProduto() {
  const loading = document.getElementById("produto-loading");
  const erro = document.getElementById("produto-erro");
  const detalhe = document.getElementById("produto-detalhe");

  if (loading) loading.hidden = false;
  if (erro) erro.hidden = true;
  if (detalhe) detalhe.hidden = true;
}

function esconderLoadingProduto() {
  const loading = document.getElementById("produto-loading");
  if (loading) loading.hidden = true;
}

function mostrarProduto() {
  const detalhe = document.getElementById("produto-detalhe");
  const erro = document.getElementById("produto-erro");

  if (detalhe) detalhe.hidden = false;
  if (erro) erro.hidden = true;
}

function mostrarErroProduto() {
  const loading = document.getElementById("produto-loading");
  const erro = document.getElementById("produto-erro");
  const detalhe = document.getElementById("produto-detalhe");

  if (loading) loading.hidden = true;
  if (erro) erro.hidden = false;
  if (detalhe) detalhe.hidden = true;
}

/* =========================================================
   DISPOSITIVO / PERFORMANCE
========================================================= */

function detectarProdutoPageDispositivo() {
  const largura = window.innerWidth || document.documentElement.clientWidth || 0;
  const ehMobile = largura <= 680;

  document.documentElement.classList.toggle("produto-page-mobile", ehMobile);
  document.body.classList.toggle("produto-page-mobile", ehMobile);
  document.documentElement.classList.toggle("produto-page-desktop", !ehMobile);
  document.body.classList.toggle("produto-page-desktop", !ehMobile);
}

/* =========================================================
   UTILITÁRIOS
========================================================= */

function imagemPrincipal(produto) {
  return Array.isArray(produto?.imagens) && produto.imagens[0]
    ? produto.imagens[0]
    : IMAGEM_FALLBACK;
}

function gerarEstrelas(nota = 5) {
  const valor = Math.max(0, Math.min(5, Number(nota) || 0));
  const cheias = Math.round(valor);

  return Array.from({ length: 5 })
    .map((_, index) => {
      const opacidade = index < cheias ? "1" : ".25";
      return `<img src="${ESTRELA_SVG}" alt="★" style="opacity:${opacidade}">`;
    })
    .join("");
}

function categoriaPublicaDoProduto(produto) {
  const sub = String(produto.subcategoria || "").trim();
  const dep = String(produto.departamento || "").trim();

  if (sub && slugify(sub) !== "geral") return sub;
  if (dep && slugify(dep) !== "geral") return dep;

  return nomePublicoPlataforma(
    produto.plataformaSlug ||
    produto.categoriaSlug ||
    produto.plataforma ||
    produto.categoria
  );
}

function nomePublicoPlataforma(slugOuNome) {
  const slug = slugify(slugOuNome);
  return NOMES_PUBLICOS_PLATAFORMA[slug] || "Produtos selecionados";
}

function hexParaRgb(hex) {
  const valor = String(hex || "#b98a37").replace("#", "").trim();

  const normalizado =
    valor.length === 3
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

function cortarTexto(texto, limite = 120) {
  const valor = String(texto || "").trim();

  if (valor.length <= limite) return valor;

  return `${valor.slice(0, limite).trim()}...`;
}

function limitarNumero(numero, minimo, maximo) {
  return Math.max(minimo, Math.min(numero, maximo));
}

function dataProduto(produto) {
  const valor = produto?.criadoEm || produto?.createdAt || produto?.atualizadoEm;

  if (valor?.toMillis) return valor.toMillis();
  if (valor?.seconds) return valor.seconds * 1000;

  return Number(produto?.id) || 0;
}

function definirTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto || "";
}

function bloquearZoomBasico() {
  document.documentElement.style.width = "100%";
  document.documentElement.style.maxWidth = "100%";
  document.documentElement.style.overflowX = "hidden";

  document.body.style.width = "100%";
  document.body.style.maxWidth = "100%";
  document.body.style.overflowX = "hidden";

  document.addEventListener(
    "gesturestart",
    event => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturechange",
    event => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gestureend",
    event => {
      event.preventDefault();
    },
    { passive: false }
  );

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
}

/* =========================================================
   FUNÇÕES GLOBAIS OPCIONAIS
========================================================= */

window.proximaImagemProdutoPage = proximaImagem;
window.imagemAnteriorProdutoPage = imagemAnterior;
window.abrirWhatsappProdutoPage = abrirWhatsappProduto;
window.compartilharProdutoPage = compartilharProduto;