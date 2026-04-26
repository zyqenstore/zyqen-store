let listaProdutos = [];
let categoriaAtual = "Todos";
let produtoAtualPopup = null;

fetch("produtos.json")
  .then(res => res.json())
  .then(data => {
    listaProdutos = data.produtos;

    mostrarProdutoDestaque();
    mostrarProdutos(listaProdutos);

    document.getElementById("pesquisa").addEventListener("input", aplicarFiltros);

    prepararFormularioComentario();
    ativarSwipeImagem();
  });

// =========================
// CARD PRODUTO
// =========================
function criarCardProduto(p) {
  const imagemPrincipal = p.imagens?.[0] || "";

  return `
    <div class="produto" onclick="abrirPopupProduto(${p.id})">
      ${p.urgencia ? `<div class="urgencia">${p.urgencia}</div>` : ""}

      <div class="imagem-area">
        <img src="${imagemPrincipal}">
      </div>

      <h2>${p.nome}</h2>

      <div class="avaliacao">
        ${gerarEstrelas(p.avaliacao)}
        <span>${p.avaliacao}</span>
      </div>

      <strong>${p.preco}</strong>
    </div>
  `;
}

// =========================
// ABRIR POPUP
// =========================
function abrirPopupProduto(id) {
  const produto = listaProdutos.find(p => p.id === id);
  produtoAtualPopup = produto;

  const img = document.getElementById("popup-imagem");
  img.src = produto.imagens[0];
  img.setAttribute("data-imagem-atual", 0);

  document.getElementById("popup-nome").textContent = produto.nome;
  document.getElementById("popup-categoria").textContent = produto.categoria;
  document.getElementById("popup-descricao").textContent = produto.descricao;

  document.getElementById("popup-preco").textContent = produto.preco;

  const antigo = document.getElementById("popup-preco-antigo");
  if (produto.precoAntigo) {
    antigo.textContent = produto.precoAntigo;
    antigo.style.display = "block";
  } else {
    antigo.style.display = "none";
  }

  const detalhesDiv = document.getElementById("popup-detalhes");
  detalhesDiv.innerHTML = produto.detalhes
    ? produto.detalhes.map(d => `<p>✔ ${d}</p>`).join("")
    : "";

  const obsDiv = document.getElementById("popup-observacoes");
  obsDiv.innerHTML = produto.observacoes
    ? produto.observacoes.map(o => `<p>⚠️ ${o}</p>`).join("")
    : "";

  const btnZap = document.getElementById("popup-whatsapp");
  btnZap.onclick = () => {
    const msg = encodeURIComponent(produto.mensagemWhatsapp || `Olá, quero saber mais sobre ${produto.nome}`);
    window.open(`https://wa.me/5575981768068?text=${msg}`, "_blank");
  };

  window.linkAtualProduto = produto.link;
  document.getElementById("popup-comprar").href = produto.link;

  mostrarComentariosProduto(produto);

  const box = document.getElementById("popup-comentarios-box");
  const btn = document.getElementById("btn-comentarios");

  if (box && btn) {
  box.classList.remove("ativo");
  btn.innerHTML = "💬 Ver comentários";
}

  document.getElementById("popup-produto").classList.add("ativo");
  document.body.style.overflow = "hidden";

  // CONTADOR
  const contador = document.getElementById("popup-contador-imagem");
  if (contador) {
    contador.textContent = `1/${produto.imagens.length}`;
  }

  // MINIATURAS
  const thumbsContainer = document.getElementById("popup-thumbs");
  if (thumbsContainer) {
    thumbsContainer.innerHTML = produto.imagens.map((img, i) => `
      <img src="${img}" class="popup-thumb ${i === 0 ? "ativa" : ""}" onclick="atualizarImagem(${i})">
    `).join("");
  }
}

// =========================
// FECHAR
// =========================
function fecharPopup() {
  document.getElementById("popup-produto").classList.remove("ativo");
  document.body.style.overflow = "auto";
}

// =========================
// COMPARTILHAR
// =========================
function compartilharProduto() {
  if (navigator.share) {
    navigator.share({
      title: "Zyqen Store",
      url: window.linkAtualProduto
    });
  } else {
    navigator.clipboard.writeText(window.linkAtualProduto);
    alert("Link copiado!");
  }
}

// =========================
// SWIPE
// =========================
function ativarSwipeImagem() {
  const img = document.getElementById("popup-imagem");

  let startX = 0;

  img.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });

  img.addEventListener("touchend", e => {
    let endX = e.changedTouches[0].clientX;

    if (endX < startX - 50) proximaImagemPopup();
    if (endX > startX + 50) imagemAnteriorPopup();
  });
}

// =========================
// TROCAR IMAGEM
// =========================
function proximaImagemPopup() {
  let atual = Number(document.getElementById("popup-imagem").getAttribute("data-imagem-atual"));
  atual++;

  if (atual >= produtoAtualPopup.imagens.length) atual = 0;

  atualizarImagem(atual);
}

function imagemAnteriorPopup() {
  let atual = Number(document.getElementById("popup-imagem").getAttribute("data-imagem-atual"));
  atual--;

  if (atual < 0) atual = produtoAtualPopup.imagens.length - 1;

  atualizarImagem(atual);
}

function atualizarImagem(index) {
  const img = document.getElementById("popup-imagem");
  img.src = produtoAtualPopup.imagens[index];
  img.setAttribute("data-imagem-atual", index);

  const contador = document.getElementById("popup-contador-imagem");
  if (contador) {
    contador.textContent = `${index + 1}/${produtoAtualPopup.imagens.length}`;
  }

  const thumbs = document.querySelectorAll(".popup-thumb");
  thumbs.forEach((t, i) => {
    t.classList.toggle("ativa", i === index);
  });
}

// =========================
// COMENTÁRIOS
// =========================
function mostrarComentariosProduto(produto) {
  const lista = document.getElementById("popup-lista-comentarios");
  const comentarios = produto.comentarios || [];

  lista.innerHTML = comentarios.map(c => `
    <div class="comentario-card">
      <strong>${c.nome}</strong>
      <div>${"⭐".repeat(c.nota)}${"☆".repeat(5 - c.nota)}</div>
      <p>${c.texto}</p>
    </div>
  `).join("");

  let media = 0;
  if (comentarios.length > 0) {
    media = comentarios.reduce((s, c) => s + c.nota, 0) / comentarios.length;
  }

  document.getElementById("popup-avaliacao-media").textContent = media.toFixed(1);
  document.getElementById("popup-avaliacao-total").textContent = `(${comentarios.length} avaliações)`;
  document.getElementById("popup-estrelas").innerHTML = gerarEstrelas(media);

  const contagem = [0, 0, 0, 0, 0];

  comentarios.forEach(c => {
    if (c.nota >= 1 && c.nota <= 5) {
      contagem[c.nota - 1]++;
    }
  });

  const total = contagem.reduce((s, n) => s + n, 0) || 1;

  for (let i = 5; i >= 1; i--) {
    const porcentagem = (contagem[i - 1] / total) * 100;

    const barra = document.getElementById(`barra-${i}`);
    if (barra) {
      barra.style.width = porcentagem + "%";
    }
  }
}

// =========================
// FORM
// =========================
function prepararFormularioComentario() {
  const form = document.getElementById("form-comentario");

  form.addEventListener("submit", async function(e) {
    e.preventDefault();

    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const formData = new FormData(form);

    // 🔥 adiciona nome do produto no email
    if (produtoAtualPopup) {
      formData.append("produto", produtoAtualPopup.nome);
    }

    try {
      const res = await fetch("https://formsubmit.co/ajax/zyqenstore@gmail.com", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        abrirPopupSucesso();
        form.reset();
      } else {
        alert("Erro ao enviar comentário. Tente novamente.");
      }

    } catch (err) {
      alert("Erro de conexão. Verifique sua internet.");
    }

    btn.disabled = false;
    btn.textContent = "Enviar comentário";
  });
}

function abrirPopupSucesso() {
  document.getElementById("popup-sucesso-comentario").classList.add("ativo");
}

function fecharPopupSucesso() {
  document.getElementById("popup-sucesso-comentario").classList.remove("ativo");
}

// =========================
// FILTROS
// =========================
function mostrarProdutos(produtos) {
  const container = document.getElementById("produtos");
  container.innerHTML = produtos.map(criarCardProduto).join("");
}

function aplicarFiltros() {
  const termo = document.getElementById("pesquisa").value.toLowerCase();

  const filtrados = listaProdutos.filter(p =>
    p.nome.toLowerCase().includes(termo)
  );

  mostrarProdutos(filtrados);
}

function filtrarCategoria(cat) {
  categoriaAtual = cat;
  aplicarFiltros();
}

function gerarEstrelas(av) {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += i < Math.floor(av) ? "⭐" : "☆";
  }
  return s;
}

function mostrarProdutoDestaque() {
  const destaque = listaProdutos.find(p => p.destaque);
  if (destaque) {
    document.getElementById("produto-destaque").innerHTML = criarCardProduto(destaque);
  }
}

// =========================
// TOGGLE COMENTÁRIOS
// =========================
function toggleComentarios() {
  const box = document.getElementById("popup-comentarios-box");
  const btn = document.getElementById("btn-comentarios");

  const aberto = box.classList.contains("ativo");

  if (aberto) {
    box.classList.remove("ativo");
    btn.innerHTML = "💬 Ver comentários";
  } else {
    box.classList.add("ativo");
    btn.innerHTML = "🔽 Ocultar comentários";
  }
}