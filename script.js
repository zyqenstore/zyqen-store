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
  search: "imagens/icones/search.svg"
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

document.addEventListener("DOMContentLoaded", () => {
  detectarDispositivo();
  bloquearZoomSite();
  ajustarSiteFixo();
  prepararConfiancaMobile();

  injetarEstiloBuscaInteligente();
  injetarEstiloPaginacao();
  injetarEstiloIconesJS();

  criarControlesBuscaInteligente();
  garantirEstruturaDinamica();

  carregarCategoriasFirebase();
  carregarProdutosFirebase();

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
  const altura = window.innerHeight || html.clientHeight || 0;

  const ehTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  const ponteiroFino = window.matchMedia("(pointer: fine)").matches;
  const hoverReal = window.matchMedia("(hover: hover)").matches;

  const mobileUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
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
  } else if (
    largura <= 1180 ||
    (ehTouch && largura <= 1366 && !(ponteiroFino && hoverReal))
  ) {
    dispositivo = "tablet";
  }

  const classeDispositivo = `modo-${dispositivo}`;
  const classeTouch = ehTouch ? "tem-touch" : "sem-touch";

  html.classList.add(classeDispositivo, classeTouch);
  body.classList.add(classeDispositivo, classeTouch);

  html.dataset.dispositivo = dispositivo;
  body.dataset.dispositivo = dispositivo;

  html.dataset.larguraTela = String(largura);
  body.dataset.larguraTela = String(largura);

  html.dataset.alturaTela = String(altura);
  body.dataset.alturaTela = String(altura);

  html.dataset.touch = ehTouch ? "sim" : "nao";
  body.dataset.touch = ehTouch ? "sim" : "nao";
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

  const impedir = (event) => {
    event.preventDefault();
  };

  document.addEventListener("gesturestart", impedir, { passive: false });
  document.addEventListener("gesturechange", impedir, { passive: false });
  document.addEventListener("gestureend", impedir, { passive: false });

  document.addEventListener("touchmove", (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });

  let ultimoToque = 0;

  document.addEventListener("touchend", (event) => {
    const agora = Date.now();

    if (agora - ultimoToque <= 320) {
      event.preventDefault();
    }

    ultimoToque = agora;
  }, { passive: false });

  document.addEventListener("wheel", (event) => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    const tecla = String(event.key || "").toLowerCase();

    const teclaZoom = [
      "+",
      "-",
      "=",
      "0",
      "_",
      "add",
      "subtract"
    ].includes(tecla);

    if ((event.ctrlKey || event.metaKey) && teclaZoom) {
      event.preventDefault();
    }
  }, { passive: false });
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



function prepararConfiancaMobile() {
  const cards = Array.from(document.querySelectorAll(".confianca-card"));

  if (!cards.length) return;

  let modal = document.getElementById("modal-confianca");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-confianca";
    modal.className = "modal-confianca";

    modal.innerHTML = `
      <div class="modal-confianca-card">
        <button type="button" class="modal-confianca-fechar" aria-label="Fechar">×</button>

        <div class="modal-confianca-icone"></div>

        <h3 class="modal-confianca-titulo"></h3>
        <p class="modal-confianca-texto"></p>
      </div>
    `;

    document.body.appendChild(modal);
  }

  const fechar = () => {
    modal.classList.remove("ativo");
  };

  const botaoFechar = modal.querySelector(".modal-confianca-fechar");

  if (botaoFechar && botaoFechar.dataset.listenerAtivo !== "sim") {
    botaoFechar.dataset.listenerAtivo = "sim";
    botaoFechar.addEventListener("click", fechar);
  }

  if (modal.dataset.listenerAtivo !== "sim") {
    modal.dataset.listenerAtivo = "sim";

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        fechar();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        fechar();
      }
    });
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
      const iconeOriginal =
        card.querySelector(".icone-circulo img") ||
        card.querySelector(".icone-circulo svg") ||
        card.querySelector("img") ||
        card.querySelector("svg");

      const modalIcone = modal.querySelector(".modal-confianca-icone");
      const modalTitulo = modal.querySelector(".modal-confianca-titulo");
      const modalTexto = modal.querySelector(".modal-confianca-texto");

      if (modalTitulo) {
        modalTitulo.textContent = titulo;
      }

      if (modalTexto) {
        modalTexto.textContent = texto;
      }

      if (modalIcone) {
        modalIcone.innerHTML = "";

        if (iconeOriginal) {
          const clone = iconeOriginal.cloneNode(true);
          clone.removeAttribute("id");
          modalIcone.appendChild(clone);
        }
      }

      modal.classList.add("ativo");
    };

    card.addEventListener("click", abrir);

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        abrir();
      }
    });
  });
}



function carregarCategoriasFirebase() {
  const categoriasRef = collection(db, "categorias");
  const q = query(categoriasRef);

  onSnapshot(q, (snapshot) => {
    listaCategorias = snapshot.docs
      .map(documento => {
        return normalizarCategoria({
          docId: documento.id,
          ...documento.data()
        });
      })
      .filter(categoria => categoria.ativa !== false)
      .sort((a, b) => {
        const ordemA = Number(a.ordem) || 999;
        const ordemB = Number(b.ordem) || 999;

        if (ordemA !== ordemB) return ordemA - ordemB;

        return a.nome.localeCompare(b.nome);
      });

    aplicarFiltros();

  }, (erro) => {
    console.warn("Não foi possível carregar categorias. Usando categorias padrão.", erro);
    listaCategorias = [];
    aplicarFiltros();
  });
}

function carregarProdutosFirebase() {
  const produtosRef = collection(db, "produtos");
  const q = query(produtosRef);

  onSnapshot(q, (snapshot) => {
    listaProdutos = snapshot.docs
      .map(documento => {
        return normalizarProduto({
          docId: documento.id,
          ...documento.data()
        });
      })
      .filter(produtoEstaAtivo);

    mostrarProdutoDestaque();
    aplicarFiltros();

    if (produtoAtualPopup) {
      const produtoAtualizado = listaProdutos.find(p =>
        String(p.id) === String(produtoAtualPopup.id) ||
        String(p.docId) === String(produtoAtualPopup.docId)
      );

      if (produtoAtualizado) {
        produtoAtualPopup = produtoAtualizado;
        midiasProdutoAtual = montarMidiasProduto(produtoAtualPopup);
        mostrarComentariosProduto(produtoAtualPopup);
      } else {
        fecharPopup();
        produtoAtualPopup = null;
        midiasProdutoAtual = [];
      }
    }

  }, (erro) => {
    console.error("Erro ao carregar produtos:", erro);
    alert("Erro ao carregar produtos do Firebase.");
  });
}



function produtoEstaAtivo(produto) {
  return produto.ativo !== false;
}

function normalizarProduto(produto) {
  const categoriaNome = produto.categoria || produto.categoriaNome || "";
  const categoriaSlug = produto.categoriaSlug || slugify(categoriaNome);

  return {
    ...produto,
    ativo: produto.ativo !== false,
    categoria: categoriaNome,
    categoriaSlug,
    imagens: Array.isArray(produto.imagens) ? produto.imagens.filter(Boolean) : [],
    videos: Array.isArray(produto.videos) ? produto.videos.filter(Boolean) : [],
    comentarios: Array.isArray(produto.comentarios) ? produto.comentarios : [],
    detalhes: Array.isArray(produto.detalhes) ? produto.detalhes : [],
    observacoes: Array.isArray(produto.observacoes) ? produto.observacoes : [],
    avaliacao: Number(produto.avaliacao) || 0,
    avaliacoes: Number(produto.avaliacoes) || 0,
    vendidos: Number(produto.vendidos) || 0,
    ordem: Number(produto.ordem) || 999,
    cliquesComprar: Number(produto.cliquesComprar) || 0,
    cliquesWhatsapp: Number(produto.cliquesWhatsapp) || 0,
    cliquesCompartilhar: Number(produto.cliquesCompartilhar) || 0,
    cliquesInstagram: Number(produto.cliquesInstagram) || 0,
    cliquesTotal: Number(produto.cliquesTotal) || 0
  };
}

function corSeguraCategoria(cor, padrao = "#22c55e") {
  const valor = String(cor || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(valor)) {
    return valor.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(valor)) {
    return "#" + valor
      .slice(1)
      .split("")
      .map(letra => letra + letra)
      .join("")
      .toLowerCase();
  }

  return padrao;
}

function corPadraoCategoria(slug, nome = "") {
  const texto = `${slug} ${nome}`.toLowerCase();

  if (texto.includes("mercado")) return "#facc15";
  if (texto.includes("shopee")) return "#f97316";
  if (texto.includes("cakto")) return "#22c55e";
  if (texto.includes("amazon")) return "#0ea5e9";
  if (texto.includes("digital")) return "#8b5cf6";

  return "#22c55e";
}

function normalizarCategoria(categoria) {
  const nome = categoria.nome || categoria.categoria || "Categoria";
  const slug = categoria.slug || slugify(nome);
  const corPadrao = corPadraoCategoria(slug, nome);

  return {
    docId: categoria.docId || "",
    nome,
    slug,
    tipo: categoria.tipo || "produto",
    caminhoImagens: categoria.caminhoImagens || `imagens/${slug}/`,
    caminhoVideos: categoria.caminhoVideos || `videos/${slug}/`,
    caminhoIcones: categoria.caminhoIcones || "imagens/icones/",
    extImagem: categoria.extImagem || ".jpg",
    extVideo: categoria.extVideo || ".mp4",
    extIcone: categoria.extIcone || ".svg",
    icone: categoria.icone || escolherIconeCategoria(nome, slug),
    corLinha: corSeguraCategoria(categoria.corLinha || categoria.corCategoria, corPadrao),
    ordem: Number(categoria.ordem) || 999,
    ativa: categoria.ativa !== false
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
      ordem: 2,
      ativa: true
    }
  ];
}

function escolherIconeCategoria(nome, slug) {
  const texto = `${nome} ${slug}`.toLowerCase();

  if (texto.includes("mercado")) return ICONES.shoppingCart;
  if (texto.includes("cakto")) return ICONES.package;
  if (texto.includes("digital")) return ICONES.package;

  return ICONES.package;
}

function categoriasAtivasComFallback() {
  const mapa = new Map();

  if (listaCategorias.length > 0) {
    listaCategorias.forEach(cat => {
      mapa.set(cat.slug, cat);
    });
  } else {
    categoriasPadrao().forEach(cat => {
      mapa.set(cat.slug, cat);
    });
  }

  listaProdutos.forEach(produto => {
    const nome = produto.categoria || produto.categoriaNome || produto.categoriaSlug || "";
    const slug = produto.categoriaSlug || slugify(nome);

    if (!nome && !slug) return;

    if (!mapa.has(slug)) {
      mapa.set(slug, normalizarCategoria({
        nome: nome || slug,
        slug,
        tipo: produto.tipo || "produto",
        ordem: 999
      }));
    }
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const ordemA = Number(a.ordem) || 999;
    const ordemB = Number(b.ordem) || 999;

    if (ordemA !== ordemB) return ordemA - ordemB;

    return a.nome.localeCompare(b.nome);
  });
}

function produtoPertenceCategoria(produto, categoria) {
  const produtoCategoriaNome = String(produto.categoria || produto.categoriaNome || "").trim();
  const produtoCategoriaSlug = String(produto.categoriaSlug || slugify(produtoCategoriaNome)).trim();

  return (
    produtoCategoriaSlug === categoria.slug ||
    slugify(produtoCategoriaNome) === categoria.slug ||
    produtoCategoriaNome.toLowerCase() === categoria.nome.toLowerCase()
  );
}

function nomeCategoriaProduto(produto) {
  const categorias = categoriasAtivasComFallback();

  const encontrada = categorias.find(cat => produtoPertenceCategoria(produto, cat));

  if (encontrada) return encontrada.nome;

  return produto.categoria || produto.categoriaSlug || "Produto";
}



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
          <span>Pesquise por nome, categoria, preço, selo, descrição ou palavras do produto.</span>
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

    const pareceIconeBusca =
      tag === "svg" ||
      tag === "i" ||
      (
        tag === "img" &&
        (
          classe.includes("search") ||
          classe.includes("busca") ||
          classe.includes("lupa") ||
          classe.includes("icone")
        )
      ) ||
      classe.includes("search") ||
      classe.includes("busca") ||
      classe.includes("lupa");

    if (pareceIconeBusca) {
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

  let filtrados = listaProdutos.filter(produto =>
    produtoEstaAtivo(produto) &&
    produtoCombinaPesquisa(produto, termo) &&
    produtoCombinaFiltroRapido(produto)
  );

  if (categoriaAtual !== "Todos") {
    const categorias = categoriasAtivasComFallback();
    const categoriaSelecionada = categorias.find(cat => cat.slug === categoriaAtual);

    if (categoriaSelecionada) {
      filtrados = filtrados.filter(produto =>
        produtoPertenceCategoria(produto, categoriaSelecionada)
      );
    }
  }

  filtrados = aplicarOrdenacaoProdutos(filtrados);

  mostrarProdutosPorCategoria(filtrados);
}

function filtrarCategoria(cat) {
  categoriaAtual = cat;
  resetarPaginas();
  aplicarFiltros();
}

function produtoCombinaPesquisa(produto, termo) {
  const termoNormalizado = normalizarTexto(termo);

  if (!termoNormalizado) return true;

  const texto = textoBuscaProduto(produto);

  const palavras = termoNormalizado
    .split(/\s+/)
    .map(palavra => palavra.trim())
    .filter(Boolean);

  return palavras.every(palavra => texto.includes(palavra));
}

function produtoCombinaFiltroRapido(produto) {
  const texto = textoBuscaProduto(produto);

  if (filtroRapidoAtual === "todos") return true;

  if (filtroRapidoAtual === "mais-vendido") {
    return (
      texto.includes("mais vendido") ||
      texto.includes("vendidos") ||
      Number(produto.vendidos) > 0 ||
      normalizarTexto(produto.selo).includes("mais vendido") ||
      normalizarTexto(produto.statusProduto).includes("mais-vendido")
    );
  }

  if (filtroRapidoAtual === "novidade") {
    return (
      texto.includes("novidade") ||
      texto.includes("lancamento") ||
      texto.includes("lançamento") ||
      normalizarTexto(produto.selo).includes("novidade") ||
      normalizarTexto(produto.statusProduto).includes("novidade")
    );
  }

  if (filtroRapidoAtual === "promocao") {
    return (
      texto.includes("promocao") ||
      texto.includes("promoção") ||
      texto.includes("oferta") ||
      texto.includes("desconto") ||
      Boolean(produto.precoAntigo) ||
      Boolean(produto.destaque)
    );
  }

  if (filtroRapidoAtual === "recomendado") {
    return (
      Boolean(produto.recomendado) ||
      texto.includes("recomendado") ||
      texto.includes("escolha da loja") ||
      texto.includes("escolha da zyqen")
    );
  }

  return true;
}

function aplicarOrdenacaoProdutos(produtos) {
  const lista = produtos.slice();

  if (ordenarAtual === "menor-preco") {
    return lista.sort((a, b) => {
      const pa = precoProduto(a);
      const pb = precoProduto(b);

      if (pa === 0 && pb !== 0) return 1;
      if (pb === 0 && pa !== 0) return -1;

      return pa - pb;
    });
  }

  if (ordenarAtual === "maior-preco") {
    return lista.sort((a, b) => precoProduto(b) - precoProduto(a));
  }

  if (ordenarAtual === "mais-avaliados") {
    return lista.sort((a, b) => {
      const notaB = Number(b.avaliacao) || 0;
      const notaA = Number(a.avaliacao) || 0;

      if (notaB !== notaA) return notaB - notaA;

      return (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0);
    });
  }

  if (ordenarAtual === "mais-vendidos") {
    return lista.sort((a, b) => {
      const vendidosB = Number(b.vendidos) || 0;
      const vendidosA = Number(a.vendidos) || 0;

      if (vendidosB !== vendidosA) return vendidosB - vendidosA;

      return (Number(b.cliquesTotal) || 0) - (Number(a.cliquesTotal) || 0);
    });
  }

  if (ordenarAtual === "novidades") {
    return lista.sort((a, b) => {
      const dataB = dataProduto(b);
      const dataA = dataProduto(a);

      if (dataB !== dataA) return dataB - dataA;

      return String(b.nome || "").localeCompare(String(a.nome || ""));
    });
  }

  return lista.sort((a, b) => {
    const destaqueA = a.destaque ? 1 : 0;
    const destaqueB = b.destaque ? 1 : 0;

    if (destaqueA !== destaqueB) return destaqueB - destaqueA;

    const ordemA = Number(a.ordem) || 999;
    const ordemB = Number(b.ordem) || 999;

    if (ordemA !== ordemB) return ordemA - ordemB;

    const recomendadoA = a.recomendado ? 1 : 0;
    const recomendadoB = b.recomendado ? 1 : 0;

    if (recomendadoA !== recomendadoB) return recomendadoB - recomendadoA;

    return String(a.nome || "").localeCompare(String(b.nome || ""));
  });
}



function garantirEstruturaDinamica() {
  if (document.getElementById("categorias-container")) return;

  const mercado = document.getElementById("produtos-mercado");
  const cakto = document.getElementById("produtos-cakto");

  if (mercado || cakto) {
    const primeiraSecao = mercado?.closest("section") || cakto?.closest("section");

    if (primeiraSecao && primeiraSecao.parentElement) {
      const container = document.createElement("div");
      container.id = "categorias-container";

      primeiraSecao.parentElement.insertBefore(container, primeiraSecao);

      if (mercado?.closest("section")) {
        mercado.closest("section").style.display = "none";
      }

      if (cakto?.closest("section")) {
        cakto.closest("section").style.display = "none";
      }
    }
  }
}

function mostrarProdutosPorCategoria(produtos) {
  const categorias = categoriasAtivasComFallback();

  renderizarBotoesFiltro(categorias);

  let categoriasParaMostrar = categorias;

  if (categoriaAtual !== "Todos") {
    categoriasParaMostrar = categorias.filter(cat => cat.slug === categoriaAtual);
  }

  renderizarSecoesCategorias(categoriasParaMostrar);

  if (categoriasParaMostrar.length === 0) {
    const container = document.getElementById("categorias-container");

    if (container) {
      container.innerHTML = `
        <div class="categoria-loading">
          Categoria não encontrada.
        </div>
      `;
    }

    return;
  }

  categoriasParaMostrar.forEach(categoria => {
    const produtosCategoria = produtos.filter(produto =>
      produtoPertenceCategoria(produto, categoria)
    );

    renderizarProdutosComPaginacao(produtosCategoria, categoria);
  });
}

function renderizarBotoesFiltro(categorias) {
  const area = document.getElementById("botoes-filtro");

  if (!area) return;

  area.classList.add("filtros-categoria-loja");

  let botoes = `
    <button 
      onclick="filtrarCategoria('Todos')"
      class="${categoriaAtual === "Todos" ? "ativo" : ""}"
      data-categoria="Todos"
    >
      Todos
    </button>
  `;

  categorias.forEach(cat => {
    botoes += `
      <button 
        onclick="filtrarCategoria('${escaparJS(cat.slug)}')"
        class="${categoriaAtual === cat.slug ? "ativo" : ""}"
        data-categoria="${escaparHTML(cat.slug)}"
      >
        ${escaparHTML(cat.nome)}
      </button>
    `;
  });

  area.innerHTML = `
    <div class="titulo-categorias-organizado">Categorias</div>
    <div class="botoes-categoria-organizado">
      ${botoes}
    </div>
  `;
}

function renderizarSecoesCategorias(categorias) {
  const container = document.getElementById("categorias-container");

  if (!container) return;

  if (categorias.length === 0) {
    container.innerHTML = `
      <div class="categoria-loading">
        Nenhuma categoria encontrada.
      </div>
    `;
    return;
  }

  container.innerHTML = categorias.map(cat => {
    const corLinha = corSeguraCategoria(
      cat.corLinha,
      corPadraoCategoria(cat.slug, cat.nome)
    );

    return `
      <section 
        id="secao-${escaparHTML(cat.slug)}" 
        class="categoria-loja" 
        data-categoria="${escaparHTML(cat.slug)}"
        style="--cor-categoria:${escaparHTML(corLinha)}"
      >
        <h2 
          class="titulo-categoria-dinamica" 
          style="--cor-categoria:${escaparHTML(corLinha)}"
        >
          <img 
            src="${cat.icone || ICONES.package}" 
            alt="${escaparHTML(cat.nome)}"
            onerror="this.onerror=null;this.src='${ICONES.package}'"
          >
          ${escaparHTML(cat.nome)}
        </h2>

        <div id="produtos-${escaparHTML(cat.slug)}" class="grid"></div>
        <div id="paginacao-${escaparHTML(cat.slug)}" class="paginacao-loja"></div>
      </section>
    `;
  }).join("");
}

function renderizarProdutosComPaginacao(produtos, categoria) {
  const grid = document.getElementById(`produtos-${categoria.slug}`);
  const secao = document.getElementById(`secao-${categoria.slug}`);
  const paginacaoEl = document.getElementById(`paginacao-${categoria.slug}`);

  if (!grid || !secao) return;

  if (produtos.length === 0) {
    if (categoriaAtual === "Todos") {
      secao.style.display = "none";
    } else {
      secao.style.display = "block";
      grid.innerHTML = `
        <div class="categoria-sem-produtos">
          Nenhum produto encontrado nesta categoria.
        </div>
      `;
    }

    if (paginacaoEl) {
      paginacaoEl.innerHTML = "";
    }

    return;
  }

  secao.style.display = "block";

  const totalPaginas = Math.ceil(produtos.length / PRODUTOS_POR_PAGINA);
  let paginaAtual = pegarPaginaAtual(categoria.slug);

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas;
    definirPaginaAtual(categoria.slug, paginaAtual);
  }

  if (paginaAtual < 1) {
    paginaAtual = 1;
    definirPaginaAtual(categoria.slug, paginaAtual);
  }

  const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
  const fim = inicio + PRODUTOS_POR_PAGINA;
  const produtosPagina = produtos.slice(inicio, fim);

  grid.innerHTML = produtosPagina.map(criarCardProduto).join("");

  renderizarPaginacao(categoria.slug, produtos.length, paginacaoEl);
}

function criarCardProduto(produto) {
  const imagemPrincipal = produto.imagens?.[0] || IMAGEM_FALLBACK;
  const produtoId = produto.id || produto.docId;

  return `
    <div class="produto" onclick="abrirPopupProduto('${escaparJS(produtoId)}')">
      ${produto.urgencia ? `<div class="urgencia">${escaparHTML(produto.urgencia)}</div>` : ""}

      <div class="imagem-area">
        <img 
          src="${imagemPrincipal}" 
          alt="${escaparHTML(produto.nome || "Produto")}"
          onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"
        >
      </div>

      <h2>${escaparHTML(produto.nome || "")}</h2>

      <div class="avaliacao">
        ${gerarEstrelas(Number(produto.avaliacao) || 0)}
        <span>${produto.avaliacao || "5.0"}</span>
      </div>

      <strong>${escaparHTML(produto.preco || "")}</strong>
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
      secao.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }
}

function gerarListaPaginas(totalPaginas, paginaAtual) {
  const paginas = [];

  if (totalPaginas <= 7) {
    for (let i = 1; i <= totalPaginas; i++) {
      paginas.push(i);
    }

    return paginas;
  }

  paginas.push(1);

  if (paginaAtual > 3) {
    paginas.push("...");
  }

  const inicio = Math.max(2, paginaAtual - 1);
  const fim = Math.min(totalPaginas - 1, paginaAtual + 1);

  for (let i = inicio; i <= fim; i++) {
    paginas.push(i);
  }

  if (paginaAtual < totalPaginas - 2) {
    paginas.push("...");
  }

  paginas.push(totalPaginas);

  return paginas;
}

function renderizarPaginacao(slug, totalProdutos, paginacaoEl) {
  if (!paginacaoEl) return;

  const totalPaginas = Math.ceil(totalProdutos / PRODUTOS_POR_PAGINA);
  const paginaAtual = pegarPaginaAtual(slug);

  if (totalPaginas <= 1) {
    paginacaoEl.innerHTML = "";
    return;
  }

  const paginas = gerarListaPaginas(totalPaginas, paginaAtual);

  let html = "";

  html += `
    <button 
      onclick="trocarPaginaProdutos('${slug}', ${Math.max(1, paginaAtual - 1)})"
      ${paginaAtual === 1 ? "disabled" : ""}
      title="Página anterior"
    >
      <img src="${ICONES.chevronLeft}" alt="Anterior">
    </button>
  `;

  paginas.forEach(p => {
    if (p === "...") {
      html += `<span class="paginacao-reticencias">...</span>`;
      return;
    }

    html += `
      <button 
        onclick="trocarPaginaProdutos('${slug}', ${p})"
        class="${p === paginaAtual ? "ativo" : ""}"
      >
        ${p}
      </button>
    `;
  });

  html += `
    <button 
      onclick="trocarPaginaProdutos('${slug}', ${Math.min(totalPaginas, paginaAtual + 1)})"
      ${paginaAtual === totalPaginas ? "disabled" : ""}
      title="Próxima página"
    >
      <img src="${ICONES.chevronRight}" alt="Próxima">
    </button>
  `;

  html += `
    <div class="paginacao-info">
      Página ${paginaAtual} de ${totalPaginas} • ${totalProdutos} produto(s)
    </div>
  `;

  paginacaoEl.innerHTML = html;
}



function mostrarProdutoDestaque() {
  const destaque = listaProdutos.find(produto =>
    produtoEstaAtivo(produto) &&
    produto.destaque === true
  );

  const area = document.getElementById("produto-destaque");

  if (!area) return;

  if (destaque) {
    area.innerHTML = criarCardProduto(destaque);
  } else {
    area.innerHTML = "";
  }

  atualizarAreaDestaque();
}

function atualizarAreaDestaque() {
  const area = document.getElementById("area-oferta-dia");
  const produtoDestaque = document.getElementById("produto-destaque");

  if (!area || !produtoDestaque) return;

  const temProduto = Boolean(produtoDestaque.querySelector(".produto"));

  if (temProduto) {
    area.hidden = false;
    area.classList.add("tem-destaque");
  } else {
    area.classList.remove("tem-destaque");
    area.hidden = true;
  }
}



function abrirPopupProduto(id) {
  const produto = listaProdutos.find(p =>
    String(p.id) === String(id) ||
    String(p.docId) === String(id)
  );

  if (!produto) {
    alert("Produto não encontrado ou está inativo.");
    return;
  }

  produtoAtualPopup = produto;
  midiasProdutoAtual = montarMidiasProduto(produto);

  renderizarMidiaPopup(0);

  const nomeEl = document.getElementById("popup-nome");
  const categoriaEl = document.getElementById("popup-categoria");
  const descricaoEl = document.getElementById("popup-descricao");
  const precoEl = document.getElementById("popup-preco");

  if (nomeEl) nomeEl.textContent = produto.nome || "";
  if (categoriaEl) categoriaEl.textContent = nomeCategoriaProduto(produto);
  if (descricaoEl) descricaoEl.textContent = produto.descricao || "";
  if (precoEl) precoEl.textContent = produto.preco || "";

  const antigo = document.getElementById("popup-preco-antigo");

  if (antigo) {
    if (produto.precoAntigo) {
      antigo.textContent = produto.precoAntigo;
      antigo.style.display = "block";
    } else {
      antigo.textContent = "";
      antigo.style.display = "none";
    }
  }

  const detalhesDiv = document.getElementById("popup-detalhes");

  if (detalhesDiv) {
    detalhesDiv.innerHTML = produto.detalhes
      ? produto.detalhes.map(d => `
        <p class="linha-icone-js">
          <img src="${ICONES.circleCheck}" alt="Detalhe" class="icone-js pequeno verde">
          <span>${escaparHTML(d)}</span>
        </p>
      `).join("")
      : "";
  }

  const obsDiv = document.getElementById("popup-observacoes");

  if (obsDiv) {
    obsDiv.innerHTML = produto.observacoes
      ? produto.observacoes.map(o => `
        <p class="linha-icone-js">
          <img src="${ICONES.triangleAlert}" alt="Observação" class="icone-js pequeno amarelo">
          <span>${escaparHTML(o)}</span>
        </p>
      `).join("")
      : "";
  }

  const btnZap = document.getElementById("popup-whatsapp");

  if (btnZap) {
    btnZap.onclick = () => {
      registrarCliqueProduto("whatsapp", produto);

      const msg = encodeURIComponent(
        produto.mensagemWhatsapp || `Olá, quero saber mais sobre ${produto.nome}`
      );

      window.open(`https://wa.me/5575981768068?text=${msg}`, "_blank");
    };
  }

  window.linkAtualProduto = produto.link || "";

  const btnComprar = document.getElementById("popup-comprar");

  if (btnComprar) {
    btnComprar.href = produto.link || "#";
    btnComprar.textContent = produto.botao || "Comprar agora";

    btnComprar.onclick = (event) => {
      event.preventDefault();

      registrarCliqueProduto("comprar", produto);

      if (produto.link) {
        window.open(produto.link, "_blank", "noopener");
      }
    };
  }

  mostrarComentariosProduto(produto);

  const box = document.getElementById("popup-comentarios-box");
  const btn = document.getElementById("btn-comentarios");

  if (box && btn) {
    box.classList.remove("ativo");
    btn.innerHTML = `
      <img src="${ICONES.messageSquare}" alt="Comentários" class="icone-js ciano">
      Ver comentários
    `;
  }

  const popup = document.getElementById("popup-produto");

  if (popup) {
    popup.classList.add("ativo");
  }

  const scrollAtual = window.scrollY || document.documentElement.scrollTop || 0;

  document.body.dataset.scrollY = String(scrollAtual);
  document.body.classList.add("popup-aberto");
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
  document.body.style.top = `-${scrollAtual}px`;

  renderizarMiniaturas();
}

function fecharPopup() {
  const scrollY = Number(document.body.dataset.scrollY || 0);

  const popup = document.getElementById("popup-produto");

  if (popup) {
    popup.classList.remove("ativo");
  }

  const video = document.querySelector("#popup-imagem");

  if (video && video.tagName === "VIDEO") {
    video.pause();
  }

  document.body.classList.remove("popup-aberto");
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.top = "";
  document.body.dataset.scrollY = "";

  window.scrollTo(0, scrollY);
}

function montarMidiasProduto(produto) {
  const imagens = produto.imagens || [];
  const videos = produto.videos || [];

  const midiasImagens = imagens.map(url => ({
    tipo: "imagem",
    url
  }));

  const midiasVideos = videos.map(url => ({
    tipo: "video",
    url
  }));

  return [...midiasImagens, ...midiasVideos];
}

function renderizarMidiaPopup(index) {
  const area = document.querySelector(".popup-imagem-area");

  if (!area) return;

  const total = midiasProdutoAtual.length;
  const midia = midiasProdutoAtual[index];

  if (!midia) {
    area.innerHTML = `
      <div 
        id="popup-imagem" 
        data-imagem-atual="0"
        style="
          width:100%;
          height:320px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#94a3b8;
          background:#020617;
        "
      >
        Sem mídia
      </div>

      <span id="popup-contador-imagem" class="contador-imagem">0/0</span>
    `;
    return;
  }

  if (midia.tipo === "video") {
    area.innerHTML = `
      <video
        id="popup-imagem"
        src="${midia.url}"
        data-imagem-atual="${index}"
        controls
        playsinline
        style="
          width:100%;
          height:100%;
          max-height:460px;
          object-fit:contain;
          background:#020617;
        "
      ></video>

      <span id="popup-contador-imagem" class="contador-imagem">
        ${index + 1}/${total}
      </span>
    `;
  } else {
    area.innerHTML = `
      <img
        id="popup-imagem"
        src="${midia.url}"
        alt="${escaparHTML(produtoAtualPopup?.nome || "Produto")}"
        data-imagem-atual="${index}"
        onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"
      >

      <span id="popup-contador-imagem" class="contador-imagem">
        ${index + 1}/${total}
      </span>
    `;
  }
}

function renderizarMiniaturas() {
  const thumbsContainer = document.getElementById("popup-thumbs");

  if (!thumbsContainer) return;

  thumbsContainer.innerHTML = midiasProdutoAtual.map((midia, i) => {
    if (midia.tipo === "video") {
      return `
        <button
          class="popup-thumb ${i === 0 ? "ativa" : ""}"
          onclick="atualizarImagem(${i})"
          style="
            width:60px;
            height:60px;
            border-radius:8px;
            border:2px solid ${i === 0 ? "#22c55e" : "transparent"};
            background:#020617;
            color:white;
            flex-shrink:0;
            cursor:pointer;
            display:flex;
            align-items:center;
            justify-content:center;
          "
          title="Vídeo"
        >
          <img src="${ICONES.play}" alt="Vídeo" class="video-thumb-icon">
        </button>
      `;
    }

    return `
      <img 
        src="${midia.url}" 
        class="popup-thumb ${i === 0 ? "ativa" : ""}" 
        onclick="atualizarImagem(${i})"
        alt="Miniatura"
        onerror="this.onerror=null;this.src='${IMAGEM_FALLBACK}'"
      >
    `;
  }).join("");
}

function atualizarImagem(index) {
  if (!midiasProdutoAtual.length) return;

  const videoAtual = document.querySelector("#popup-imagem");

  if (videoAtual && videoAtual.tagName === "VIDEO") {
    videoAtual.pause();
  }

  renderizarMidiaPopup(index);

  const thumbs = document.querySelectorAll(".popup-thumb");

  thumbs.forEach((thumb, i) => {
    thumb.classList.toggle("ativa", i === index);

    if (thumb.tagName === "BUTTON") {
      thumb.style.borderColor = i === index ? "#22c55e" : "transparent";
    }
  });
}

function ativarSwipeImagem() {
  const area = document.querySelector(".popup-imagem-area");

  if (!area) return;

  let startX = 0;

  area.addEventListener("touchstart", event => {
    if (event.touches && event.touches.length === 1) {
      startX = event.touches[0].clientX;
    }
  }, { passive: true });

  area.addEventListener("touchend", event => {
    const endX = event.changedTouches[0].clientX;

    if (endX < startX - 50) proximaImagemPopup();
    if (endX > startX + 50) imagemAnteriorPopup();
  }, { passive: true });
}

function proximaImagemPopup() {
  if (!midiasProdutoAtual.length) return;

  const el = document.getElementById("popup-imagem");

  let atual = Number(el?.getAttribute("data-imagem-atual") || 0);

  atual++;

  if (atual >= midiasProdutoAtual.length) atual = 0;

  atualizarImagem(atual);
}

function imagemAnteriorPopup() {
  if (!midiasProdutoAtual.length) return;

  const el = document.getElementById("popup-imagem");

  let atual = Number(el?.getAttribute("data-imagem-atual") || 0);

  atual--;

  if (atual < 0) atual = midiasProdutoAtual.length - 1;

  atualizarImagem(atual);
}



function mostrarComentariosProduto(produto) {
  const lista = document.getElementById("popup-lista-comentarios");
  const comentarios = produto.comentarios || [];

  if (!lista) return;

  if (comentarios.length === 0) {
    lista.innerHTML = `<p class="sem-comentarios">Nenhum comentário ainda.</p>`;
  } else {
    lista.innerHTML = comentarios.map(comentario => {
      const nota = Math.max(1, Math.min(5, Number(comentario.nota) || 5));

      return `
        <div class="comentario-card">
          <strong>${escaparHTML(comentario.nome || "Cliente")}</strong>
          <div>${gerarEstrelas(nota)}</div>
          <p>${escaparHTML(comentario.texto || "")}</p>
        </div>
      `;
    }).join("");
  }

  let media = Number(produto.avaliacao) || 0;

  if (comentarios.length > 0) {
    media = comentarios.reduce((soma, comentario) => {
      return soma + (Number(comentario.nota) || 5);
    }, 0) / comentarios.length;
  }

  const mediaEls = document.querySelectorAll("#popup-avaliacao-media");
  const totalEls = document.querySelectorAll("#popup-avaliacao-total");
  const estrelasEl = document.getElementById("popup-estrelas");

  mediaEls.forEach(el => {
    el.textContent = media.toFixed(1);
  });

  totalEls.forEach(el => {
    el.textContent = `(${comentarios.length || produto.avaliacoes || 0} avaliações)`;
  });

  if (estrelasEl) {
    estrelasEl.innerHTML = gerarEstrelas(media);
  }

  const contagem = [0, 0, 0, 0, 0];

  comentarios.forEach(comentario => {
    const nota = Number(comentario.nota) || 5;

    if (nota >= 1 && nota <= 5) {
      contagem[nota - 1]++;
    }
  });

  const total = contagem.reduce((soma, numero) => soma + numero, 0) || 1;

  for (let i = 5; i >= 1; i--) {
    const porcentagem = (contagem[i - 1] / total) * 100;
    const barra = document.getElementById(`barra-${i}`);

    if (barra) {
      barra.style.width = porcentagem + "%";
    }
  }
}

function toggleComentarios() {
  const box = document.getElementById("popup-comentarios-box");
  const btn = document.getElementById("btn-comentarios");

  if (!box || !btn) return;

  const aberto = box.classList.contains("ativo");

  if (aberto) {
    box.classList.remove("ativo");

    btn.innerHTML = `
      <img src="${ICONES.messageSquare}" alt="Comentários" class="icone-js ciano">
      Ver comentários
    `;
  } else {
    box.classList.add("ativo");

    btn.innerHTML = `
      <img src="${ICONES.chevronDown}" alt="Ocultar" class="icone-js ciano">
      Ocultar comentários
    `;
  }
}

function prepararFormularioComentario() {
  const form = document.getElementById("form-comentario");

  if (!form) return;

  if (form.dataset.listenerAtivo === "sim") return;
  form.dataset.listenerAtivo = "sim";

  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    event.stopPropagation();

    if (comentarioEnviando) return;

    comentarioEnviando = true;

    if (!produtoAtualPopup) {
      alert("Abra um produto antes de comentar.");
      comentarioEnviando = false;
      return;
    }

    if (!produtoAtualPopup.docId) {
      alert("Erro: produto sem ID do Firebase.");
      comentarioEnviando = false;
      return;
    }

    const btn = form.querySelector("button");

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <img src="${ICONES.send}" alt="Enviando" class="icone-js pequeno ciano">
        Enviando...
      `;
    }

    const formData = new FormData(form);

    const nome = String(formData.get("name") || "").trim();
    const email = "zyqenstore@gmail.com";
    const texto = String(formData.get("message") || "").trim();
    const nota = Number(formData.get("nota")) || 5;

    formData.set("email", email);
    formData.set("from_name", nome);
    formData.set("subject", `Novo comentário no site Zyqen Store - ${nome}`);
    formData.append("produto", produtoAtualPopup.nome || "");
    formData.append("nota", String(nota));

    if (!nome) {
      alert("Digite seu nome.");
      finalizarEnvioComentario(btn);
      return;
    }

    if (!texto) {
      alert("Escreva seu comentário.");
      finalizarEnvioComentario(btn);
      return;
    }

    if (comentarioJaExiste(produtoAtualPopup, nome, email, texto)) {
      abrirPopupSucessoComentario();
      form.reset();
      finalizarEnvioComentario(btn);
      return;
    }

    const novoComentario = {
      id: Date.now() + Math.floor(Math.random() * 999),
      nome,
      email,
      texto,
      nota,
      origem: "site",
      status: "publicado",
      criadoEm: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, "produtos", produtoAtualPopup.docId), {
        comentarios: arrayUnion(novoComentario)
      });

      try {
        await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData
        });
      } catch (erroEmail) {
        console.warn("Comentário salvo no Firebase, mas falhou ao enviar e-mail:", erroEmail);
      }

      form.reset();
      abrirPopupSucessoComentario();

    } catch (erro) {
      console.error(erro);
      alert("Erro ao enviar comentário. Tente novamente.");
    }

    finalizarEnvioComentario(btn);
  });
}

function comentarioJaExiste(produto, nome, email, texto) {
  const comentarios = produto.comentarios || [];
  const agora = Date.now();

  return comentarios.some(comentario => {
    const mesmoNome = String(comentario.nome || "").trim().toLowerCase() === String(nome || "").trim().toLowerCase();
    const mesmoEmail = String(comentario.email || "").trim().toLowerCase() === String(email || "").trim().toLowerCase();
    const mesmoTexto = String(comentario.texto || "").trim().toLowerCase() === String(texto || "").trim().toLowerCase();

    if (!mesmoNome || !mesmoEmail || !mesmoTexto) return false;

    const tempoComentario = comentario.criadoEm
      ? new Date(comentario.criadoEm).getTime()
      : 0;

    if (!tempoComentario) return mesmoNome && mesmoEmail && mesmoTexto;

    const diferenca = agora - tempoComentario;

    return diferenca < 2 * 60 * 1000;
  });
}

function finalizarEnvioComentario(btn) {
  comentarioEnviando = false;

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `
      <img src="${ICONES.send}" alt="Enviar" class="icone-js pequeno ciano">
      Enviar comentário
    `;
  }
}

function abrirPopupSucessoComentario() {
  const popup = document.getElementById("popup-sucesso-comentario");

  if (popup) {
    popup.classList.add("ativo");
  }
}

function fecharPopupSucessoComentario() {
  const popup = document.getElementById("popup-sucesso-comentario");

  if (popup) {
    popup.classList.remove("ativo");
  }
}

function abrirPopupSucesso() {
  abrirPopupSucessoComentario();
}

function fecharPopupSucesso() {
  fecharPopupSucessoComentario();
}



function campoClique(tipo) {
  const mapa = {
    comprar: "cliquesComprar",
    whatsapp: "cliquesWhatsapp",
    compartilhar: "cliquesCompartilhar",
    instagram: "cliquesInstagram"
  };

  return mapa[tipo] || null;
}

async function registrarCliqueProduto(tipo, produto = produtoAtualPopup) {
  if (!produto || !produto.docId) return;

  const campo = campoClique(tipo);

  if (!campo) return;

  const chave = `zyqen_clique_${produto.docId}_${tipo}`;
  const agora = Date.now();
  const ultimo = Number(localStorage.getItem(chave) || 0);

  if (cliquesEmAndamento.has(chave)) return;

  if (ultimo && agora - ultimo < TEMPO_BLOQUEIO_CLIQUE) {
    return;
  }

  cliquesEmAndamento.add(chave);

  try {
    await updateDoc(doc(db, "produtos", produto.docId), {
      [campo]: increment(1),
      cliquesTotal: increment(1)
    });

    localStorage.setItem(chave, String(agora));

  } catch (erro) {
    console.warn("Não foi possível registrar clique:", tipo, erro);
  }

  cliquesEmAndamento.delete(chave);
}

function prepararCliquesInstagram() {
  const links = document.querySelectorAll('a[href*="instagram.com"]');

  links.forEach(link => {
    if (link.dataset.cliqueInstagramAtivo === "sim") return;

    link.dataset.cliqueInstagramAtivo = "sim";

    link.addEventListener("click", () => {
      if (produtoAtualPopup) {
        registrarCliqueProduto("instagram", produtoAtualPopup);
      }
    });
  });
}

function compartilharProduto() {
  if (produtoAtualPopup) {
    registrarCliqueProduto("compartilhar", produtoAtualPopup);
  }

  if (navigator.share) {
    navigator.share({
      title: produtoAtualPopup?.nome || "Zyqen Store",
      url: window.linkAtualProduto
    });
  } else {
    navigator.clipboard.writeText(window.linkAtualProduto || "");
    alert("Link copiado!");
  }
}



function injetarEstiloBuscaInteligente() {
  if (document.getElementById("css-busca-inteligente-zyqen")) return;

  const style = document.createElement("style");
  style.id = "css-busca-inteligente-zyqen";

  style.innerHTML = `
    .busca-inteligente-painel {
      width: min(94%, 1120px);
      margin: 18px auto 26px;
      padding: 18px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 24px;
      background:
        radial-gradient(circle at top left, rgba(34, 211, 238, 0.12), transparent 35%),
        radial-gradient(circle at top right, rgba(34, 197, 94, 0.10), transparent 35%),
        rgba(15, 23, 42, 0.70);
      box-shadow: 0 18px 55px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(10px);
    }

    .busca-inteligente-topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .busca-inteligente-topo strong {
      display: block;
      color: #f8fafc;
      font-size: 16px;
      letter-spacing: 0.2px;
    }

    .busca-inteligente-topo span {
      display: block;
      margin-top: 3px;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.35;
    }

    .busca-linha-superior {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) 300px;
      gap: 12px;
      align-items: center;
    }

    .campo-pesquisa-organizado {
      position: relative;
      width: 100%;
    }

    .campo-pesquisa-organizado img {
      position: absolute;
      left: 15px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      opacity: 0.74;
      pointer-events: none;
      filter: invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%);
      z-index: 2;
    }

    #pesquisa.pesquisa-organizada-js,
    .pesquisa-organizada-js {
      width: 100% !important;
      max-width: 100% !important;
      min-height: 48px !important;
      margin: 0 !important;
      padding: 0 16px 0 46px !important;
      border: 1px solid rgba(148, 163, 184, 0.28) !important;
      border-radius: 16px !important;
      background: rgba(2, 6, 23, 0.62) !important;
      color: #f8fafc !important;
      outline: none !important;
      font-weight: 600 !important;
      font-size: 16px !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), 0 12px 26px rgba(0,0,0,0.18) !important;
    }

    #pesquisa.pesquisa-organizada-js::placeholder {
      color: #94a3b8;
      font-weight: 500;
    }

    #pesquisa.pesquisa-organizada-js:focus {
      border-color: rgba(34, 211, 238, 0.85) !important;
      box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.14), 0 12px 26px rgba(0,0,0,0.18) !important;
    }

    #ordenarProdutos {
      min-height: 48px;
      padding: 0 14px;
      margin: 0;
      display: block;
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 16px;
      background: rgba(2, 6, 23, 0.62);
      color: #f8fafc;
      outline: none;
      font-weight: 800;
      font-size: 16px;
      cursor: pointer;
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
    }

    #ordenarProdutos:focus {
      border-color: rgba(34, 211, 238, 0.85);
      box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.14), 0 12px 26px rgba(0, 0, 0, 0.18);
    }

    .grupo-filtros-rapidos {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(148, 163, 184, 0.13);
    }

    .titulo-filtro-organizado,
    .titulo-categorias-organizado {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.11em;
      text-align: center;
      margin-bottom: 10px;
    }

    .filtros-rapidos-busca,
    .botoes-categoria-organizado {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 0 auto;
      padding: 0;
    }

    .filtros-rapidos-busca button,
    #botoes-filtro button {
      border: 1px solid rgba(148, 163, 184, 0.25) !important;
      border-radius: 999px !important;
      padding: 10px 14px !important;
      background: rgba(15, 23, 42, 0.86) !important;
      color: #e2e8f0 !important;
      cursor: pointer !important;
      font-weight: 900 !important;
      transition: 0.2s !important;
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14) !important;
      touch-action: manipulation;
    }

    .filtros-rapidos-busca button:hover,
    #botoes-filtro button:hover {
      transform: translateY(-1px);
      border-color: rgba(34, 211, 238, 0.72) !important;
      box-shadow: 0 12px 25px rgba(34, 211, 238, 0.12) !important;
    }

    .filtros-rapidos-busca button.ativo,
    #botoes-filtro button.ativo {
      background: linear-gradient(90deg, #22c55e, #22d3ee) !important;
      color: #04111f !important;
      border-color: transparent !important;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.14) inset,
        0 12px 30px rgba(34, 211, 238, 0.22),
        0 8px 26px rgba(34, 197, 94, 0.18) !important;
      transform: translateY(-1px);
    }

    #botoes-filtro.filtros-categoria-loja {
      width: min(94%, 1120px);
      margin: 10px auto 26px !important;
      padding: 14px 14px 16px !important;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.46);
    }

    .busca-antiga-limpa > svg,
    .busca-antiga-limpa > i,
    .busca-antiga-limpa > img {
      display: none !important;
    }

    @media (max-width: 720px) {
      .busca-inteligente-painel {
        width: calc(100% - 20px);
        margin-top: 14px;
        padding: 14px;
        border-radius: 20px;
      }

      .busca-linha-superior {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .busca-inteligente-topo strong,
      .busca-inteligente-topo span {
        text-align: center;
      }

      .filtros-rapidos-busca,
      .botoes-categoria-organizado {
        gap: 6px;
      }

      .filtros-rapidos-busca button,
      #botoes-filtro button {
        font-size: 12px !important;
        padding: 9px 11px !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function injetarEstiloIconesJS() {
  if (document.getElementById("css-icones-js-zyqen")) return;

  const style = document.createElement("style");
  style.id = "css-icones-js-zyqen";

  style.innerHTML = `
    .icone-js {
      width: 18px;
      height: 18px;
      object-fit: contain;
      flex-shrink: 0;
      filter: brightness(0) invert(1);
    }

    .icone-js.pequeno {
      width: 15px;
      height: 15px;
    }

    .icone-js.medio {
      width: 22px;
      height: 22px;
    }

    .icone-js.verde {
      filter: invert(57%) sepia(85%) saturate(495%) hue-rotate(88deg) brightness(95%) contrast(88%);
    }

    .icone-js.amarelo {
      filter: invert(86%) sepia(84%) saturate(872%) hue-rotate(356deg) brightness(103%) contrast(96%);
    }

    .icone-js.ciano {
      filter: invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%);
    }

    .icone-js.roxo {
      filter: invert(56%) sepia(77%) saturate(2100%) hue-rotate(226deg) brightness(96%) contrast(96%);
    }

    .linha-icone-js {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .linha-icone-js img {
      margin-top: 2px;
    }

    .estrelas-icone {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      vertical-align: middle;
    }

    .estrelas-icone img {
      width: 15px;
      height: 15px;
      object-fit: contain;
    }

    .estrelas-icone img.estrela-cheia {
      filter: drop-shadow(0 0 5px rgba(250, 204, 21, 0.35));
    }

    .estrelas-icone img.estrela-vazia {
      opacity: 0.42;
      filter: invert(63%) sepia(11%) saturate(564%) hue-rotate(176deg) brightness(92%) contrast(84%);
    }

    .avaliacao {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .avaliacao .estrelas-icone img {
      width: 14px;
      height: 14px;
    }

    #popup-estrelas .estrelas-icone img {
      width: 18px;
      height: 18px;
    }

    .comentario-card .estrelas-icone img {
      width: 14px;
      height: 14px;
    }

    .btn-ver-comentarios {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-ver-comentarios img {
      width: 18px;
      height: 18px;
      object-fit: contain;
      filter: invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%);
    }

    .video-thumb-icon {
      width: 24px;
      height: 24px;
      object-fit: contain;
      filter: invert(56%) sepia(77%) saturate(2100%) hue-rotate(226deg) brightness(96%) contrast(96%);
    }

    #form-comentario button img {
      width: 16px;
      height: 16px;
      object-fit: contain;
      filter: invert(78%) sepia(59%) saturate(1324%) hue-rotate(147deg) brightness(98%) contrast(94%);
    }
  `;

  document.head.appendChild(style);
}

function injetarEstiloPaginacao() {
  if (document.getElementById("css-paginacao-zyqen")) return;

  const style = document.createElement("style");
  style.id = "css-paginacao-zyqen";

  style.innerHTML = `
    .paginacao-loja {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 20px 12px 28px;
    }

    .paginacao-loja button {
      min-width: 40px;
      height: 40px;
      padding: 0 12px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.85);
      color: #fff;
      cursor: pointer;
      font-weight: 800;
      transition: 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .paginacao-loja button:hover {
      transform: translateY(-2px);
      border-color: #22d3ee;
      box-shadow: 0 8px 22px rgba(34, 211, 238, 0.18);
    }

    .paginacao-loja button.ativo {
      background: linear-gradient(90deg, #22d3ee, #8b5cf6, #ff2fb3);
      border-color: transparent;
      color: white;
      box-shadow: 0 8px 25px rgba(139, 92, 246, 0.25);
    }

    .paginacao-loja button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .paginacao-loja button img {
      width: 18px;
      height: 18px;
      object-fit: contain;
      filter: brightness(0) invert(1);
      pointer-events: none;
    }

    .paginacao-info {
      width: 100%;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      margin-top: 4px;
    }

    .paginacao-reticencias {
      color: #94a3b8;
      padding: 0 4px;
      font-weight: bold;
    }

    @media (max-width: 600px) {
      .paginacao-loja {
        gap: 6px;
        padding-bottom: 22px;
      }

      .paginacao-loja button {
        min-width: 36px;
        height: 36px;
        border-radius: 10px;
        font-size: 13px;
      }
    }
  `;

  document.head.appendChild(style);
}



function gerarEstrelas(avaliacao) {
  let html = `<span class="estrelas-icone">`;
  const nota = Math.floor(Number(avaliacao) || 0);

  for (let i = 0; i < 5; i++) {
    const cheia = i < nota;

    html += `
      <img 
        src="${cheia ? ICONES.starCheia : ICONES.star}" 
        class="${cheia ? "estrela-cheia" : "estrela-vazia"}"
        alt="${cheia ? "Estrela cheia" : "Estrela vazia"}"
        onerror="this.style.display='none'"
      >
    `;
  }

  html += `</span>`;

  return html;
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(texto) {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numeroPreco(valor) {
  let texto = String(valor || "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/[^\d.,]/g, "");

  if (!texto) return 0;

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  return Number(texto) || 0;
}

function precoProduto(produto) {
  return numeroPreco(produto.preco || produto.precoAtual || produto.valor || 0);
}

function dataProduto(produto) {
  const campos = [
    produto.criadoEm,
    produto.createdAt,
    produto.dataCriacao,
    produto.atualizadoEm,
    produto.updatedAt
  ];

  for (const campo of campos) {
    if (!campo) continue;

    if (typeof campo?.toDate === "function") {
      const tempo = campo.toDate().getTime();
      if (!Number.isNaN(tempo)) return tempo;
    }

    const tempo = new Date(campo).getTime();

    if (!Number.isNaN(tempo)) return tempo;
  }

  return 0;
}

function textoBuscaProduto(produto) {
  const detalhes = Array.isArray(produto.detalhes) ? produto.detalhes.join(" ") : "";
  const observacoes = Array.isArray(produto.observacoes) ? produto.observacoes.join(" ") : "";
  const comentarios = Array.isArray(produto.comentarios)
    ? produto.comentarios.map(c => `${c.nome || ""} ${c.texto || ""}`).join(" ")
    : "";

  const tagsExtras = [];

  if (produto.destaque) tagsExtras.push("destaque oferta promocao promoção");
  if (produto.recomendado) tagsExtras.push("recomendado escolha da loja");
  if (Number(produto.vendidos) > 0) tagsExtras.push("mais vendido vendidos popular");
  if (produto.precoAntigo) tagsExtras.push("desconto promocao promoção oferta");
  if (normalizarTexto(produto.selo).includes("novidade")) tagsExtras.push("novidade lancamento lançamento");
  if (normalizarTexto(produto.statusProduto).includes("novidade")) tagsExtras.push("novidade lancamento lançamento");

  return normalizarTexto(`
    ${produto.nome || ""}
    ${produto.categoria || ""}
    ${produto.categoriaSlug || ""}
    ${produto.descricao || ""}
    ${produto.preco || ""}
    ${produto.precoAntigo || ""}
    ${produto.selo || ""}
    ${produto.tipoDestaque || ""}
    ${produto.urgencia || ""}
    ${produto.botao || ""}
    ${produto.tipo || ""}
    ${produto.statusProduto || ""}
    ${produto.nivelPreco || ""}
    ${detalhes}
    ${observacoes}
    ${comentarios}
    ${tagsExtras.join(" ")}
  `);
}

function escaparHTML(texto) {
  return String(texto || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparJS(texto) {
  return String(texto || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;");
}

window.abrirPopupProduto = abrirPopupProduto;
window.fecharPopup = fecharPopup;
window.compartilharProduto = compartilharProduto;
window.atualizarImagem = atualizarImagem;
window.filtrarCategoria = filtrarCategoria;
window.filtrarRapido = filtrarRapido;
window.toggleComentarios = toggleComentarios;
window.trocarPaginaProdutos = trocarPaginaProdutos;
window.abrirPopupSucesso = abrirPopupSucesso;
window.fecharPopupSucesso = fecharPopupSucesso;
window.abrirPopupSucessoComentario = abrirPopupSucessoComentario;
window.fecharPopupSucessoComentario = fecharPopupSucessoComentario;
window.bloquearZoomSite = bloquearZoomSite;
window.atualizarAreaDestaque = atualizarAreaDestaque;
window.prepararConfiancaMobile = prepararConfiancaMobile;