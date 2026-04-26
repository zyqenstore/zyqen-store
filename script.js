let listaProdutos = [];
let categoriaAtual = "Todos";
let produtoAtualPopup = null;

fetch("produtos.json")
  .then(res => res.json())
  .then(data => {
    listaProdutos = data.produtos;

    mostrarProdutoDestaque();
    mostrarProdutos(listaProdutos);

    const pesquisa = document.getElementById("pesquisa");
    pesquisa.addEventListener("input", aplicarFiltros);

    prepararFormularioComentario();
  })
  .catch(error => {
    console.error("Erro ao carregar produtos:", error);
  });

function criarCardProduto(p) {
  const imagemPrincipal = p.imagens && p.imagens.length > 0 ? p.imagens[0] : "";
  const classeEspecial = p.tipo === "cakto" ? "produto-cakto" : "";

  return `
    <div 
      class="produto ${p.destaque ? "produto-destaque-card" : ""} ${classeEspecial}"
      onclick="abrirPopupProduto(${p.id})"
    >
      ${p.urgencia ? `<div class="urgencia">${p.urgencia}</div>` : ""}

      <div class="topo-card">
        <span class="selo">${p.selo}</span>
        <span class="categoria">${p.categoria}</span>
      </div>

      <div class="imagem-area">
        <button class="btn-img esquerda" onclick="event.stopPropagation(); imagemAnterior(${p.id})">‹</button>

        <img 
          id="imagem-produto-${p.id}" 
          src="${imagemPrincipal}" 
          alt="${p.nome}"
          data-imagem-atual="0"
        >

        <button class="btn-img direita" onclick="event.stopPropagation(); proximaImagem(${p.id})">›</button>
      </div>

      <h2>${p.nome}</h2>

      <div class="avaliacao">
        ${gerarEstrelas(p.avaliacao)}
        <span>${p.avaliacao} (${p.avaliacoes || 0} avaliações)</span>
      </div>

      ${p.vendidos ? `<div class="prova-social">🛒 +${p.vendidos} pessoas já acessaram</div>` : ""}

      <p>${p.descricao}</p>

      ${p.precoAntigo ? `<span class="preco-antigo">${p.precoAntigo}</span>` : ""}
      <strong>${p.preco}</strong>

      <a href="${p.link}" target="_blank" onclick="event.stopPropagation();">
        ${p.botao || "Ver oferta"}
      </a>
    </div>
  `;
}

function abrirPopupProduto(id) {
  const produto = listaProdutos.find(p => p.id === id);
  if (!produto) return;

  produtoAtualPopup = produto;

  const popup = document.getElementById("popup-produto");

  const imagem = document.getElementById("popup-imagem");
  imagem.src = produto.imagens[0];
  imagem.alt = produto.nome;
  imagem.setAttribute("data-imagem-atual", 0);

  document.getElementById("popup-categoria").textContent = produto.categoria;
  document.getElementById("popup-nome").textContent = produto.nome;

  document.getElementById("popup-avaliacao").innerHTML = `
    ${gerarEstrelas(produto.avaliacao)}
    <span>${produto.avaliacao} (${produto.avaliacoes || 0} avaliações)</span>
  `;

  document.getElementById("popup-descricao").textContent = produto.descricao;

  const precoAntigo = document.getElementById("popup-preco-antigo");
  if (produto.precoAntigo) {
    precoAntigo.textContent = produto.precoAntigo;
    precoAntigo.style.display = "block";
  } else {
    precoAntigo.style.display = "none";
  }

  document.getElementById("popup-preco").textContent = produto.preco;

  const botaoComprar = document.getElementById("popup-comprar");
  botaoComprar.href = produto.link;
  botaoComprar.textContent = produto.botao || "Comprar agora";

  mostrarResumoAvaliacoes(produto);
  mostrarComentariosProduto(produto);

  const areaComentarios = document.getElementById("area-comentarios");
  if (areaComentarios) {
    areaComentarios.classList.remove("ativo");
  }

  const form = document.getElementById("form-comentario");
  if (form) {
    form.reset();
  }

  popup.classList.add("ativo");
  document.body.style.overflow = "hidden";
}

function mostrarResumoAvaliacoes(produto) {
  const notaGeral = document.getElementById("popup-nota-geral");
  if (!notaGeral) return;

  notaGeral.innerHTML = `⭐ ${produto.avaliacao} (${produto.avaliacoes || 0} avaliações)`;

  const comentarios = produto.comentarios || [];
  const total = comentarios.length;

  const contagem = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  };

  comentarios.forEach(comentario => {
    const nota = Number(comentario.nota);
    if (contagem[nota] !== undefined) {
      contagem[nota]++;
    }
  });

  for (let i = 1; i <= 5; i++) {
    const barra = document.getElementById(`bar-${i}`);
    if (!barra) continue;

    const porcentagem = total ? (contagem[i] / total) * 100 : 0;
    barra.style.width = porcentagem + "%";
  }
}

function mostrarComentariosProduto(produto) {
  const listaComentarios = document.getElementById("popup-lista-comentarios");
  if (!listaComentarios) return;

  const comentarios = produto.comentarios || [];

  if (comentarios.length === 0) {
    listaComentarios.innerHTML = `
      <p class="sem-comentarios">Ainda não há comentários para este produto.</p>
    `;
    return;
  }

  listaComentarios.innerHTML = comentarios.map(comentario => `
    <div class="comentario-card">
      <div class="topo-comentario">
        <strong>${comentario.nome}</strong>
        <span class="tag">✔ Compra verificada</span>
      </div>

      <div class="estrelas">${"⭐".repeat(Number(comentario.nota))}</div>

      <p>${comentario.texto}</p>

      <div class="acoes-comentario">
        👍 ${comentario.likes || Math.floor(Math.random() * 50) + 1} pessoas acharam útil
      </div>
    </div>
  `).join("");
}

function toggleComentarios() {
  const area = document.getElementById("area-comentarios");

  if (!area) return;

  area.classList.toggle("ativo");
}

function prepararFormularioComentario() {
  const form = document.getElementById("form-comentario");

  if (!form) return;

  form.addEventListener("submit", function(event) {
    event.preventDefault();

    const botao = form.querySelector("button");
    botao.disabled = true;
    botao.textContent = "Enviando...";

    const dados = new FormData(form);

    if (produtoAtualPopup) {
      dados.append("produto", produtoAtualPopup.nome);
    }

    fetch("https://formsubmit.co/ajax/zyqenstore@gmail.com", {
      method: "POST",
      body: dados
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Erro ao enviar comentário.");
        }

        return response.json();
      })
      .then(() => {
        form.reset();
        fecharPopup();
        abrirPopupSucesso();
      })
      .catch(error => {
        console.error(error);
        alert("Não foi possível enviar agora. Tente novamente em alguns instantes.");
      })
      .finally(() => {
        botao.disabled = false;
        botao.textContent = "Enviar comentário";
      });
  });
}

function abrirPopupSucesso() {
  const popupSucesso = document.getElementById("popup-sucesso-comentario");
  popupSucesso.classList.add("ativo");
  document.body.style.overflow = "hidden";
}

function fecharPopupSucesso() {
  const popupSucesso = document.getElementById("popup-sucesso-comentario");
  popupSucesso.classList.remove("ativo");
  document.body.style.overflow = "auto";
}

function popupProximaImagem() {
  if (!produtoAtualPopup) return;

  const imagem = document.getElementById("popup-imagem");

  let atual = Number(imagem.getAttribute("data-imagem-atual"));
  atual++;

  if (atual >= produtoAtualPopup.imagens.length) {
    atual = 0;
  }

  imagem.src = produtoAtualPopup.imagens[atual];
  imagem.setAttribute("data-imagem-atual", atual);
}

function popupImagemAnterior() {
  if (!produtoAtualPopup) return;

  const imagem = document.getElementById("popup-imagem");

  let atual = Number(imagem.getAttribute("data-imagem-atual"));
  atual--;

  if (atual < 0) {
    atual = produtoAtualPopup.imagens.length - 1;
  }

  imagem.src = produtoAtualPopup.imagens[atual];
  imagem.setAttribute("data-imagem-atual", atual);
}

function fecharPopup() {
  const popup = document.getElementById("popup-produto");
  popup.classList.remove("ativo");
  document.body.style.overflow = "auto";
}

document.addEventListener("click", function(event) {
  const popup = document.getElementById("popup-produto");

  if (popup && popup.classList.contains("ativo")) {
    if (event.target === popup) {
      fecharPopup();
    }
  }
});

function mostrarProdutoDestaque() {
  const containerDestaque = document.getElementById("produto-destaque");
  const produtoDestaque = listaProdutos.find(produto => produto.destaque === true);

  if (!containerDestaque || !produtoDestaque) return;

  containerDestaque.innerHTML = criarCardProduto(produtoDestaque);
}

function mostrarProdutos(produtos) {
  const container = document.getElementById("produtos");
  container.innerHTML = "";

  if (produtos.length === 0) {
    container.innerHTML = `
      <div class="sem-produtos">
        <h2>Nenhum produto encontrado</h2>
        <p>Tente pesquisar por outro nome ou categoria.</p>
      </div>
    `;
    return;
  }

  produtos.forEach(p => {
    container.innerHTML += criarCardProduto(p);
  });
}

function aplicarFiltros() {
  const termo = document.getElementById("pesquisa").value.toLowerCase();

  const produtosFiltrados = listaProdutos.filter(produto => {
    const combinaPesquisa = produto.nome.toLowerCase().includes(termo);
    const combinaCategoria = categoriaAtual === "Todos" || produto.categoria === categoriaAtual;

    return combinaPesquisa && combinaCategoria;
  });

  mostrarProdutos(produtosFiltrados);
}

function filtrarCategoria(categoria) {
  categoriaAtual = categoria;
  aplicarFiltros();
}

function gerarEstrelas(avaliacao) {
  const estrelasCheias = Math.floor(Number(avaliacao));
  let estrelas = "";

  for (let i = 0; i < 5; i++) {
    estrelas += i < estrelasCheias ? "⭐" : "☆";
  }

  return estrelas;
}

function proximaImagem(id) {
  const produto = listaProdutos.find(p => p.id === id);
  const imagensDoProduto = document.querySelectorAll(`#imagem-produto-${id}`);

  imagensDoProduto.forEach(imagem => {
    let atual = Number(imagem.getAttribute("data-imagem-atual"));
    atual++;

    if (atual >= produto.imagens.length) {
      atual = 0;
    }

    imagem.src = produto.imagens[atual];
    imagem.setAttribute("data-imagem-atual", atual);
  });
}

function imagemAnterior(id) {
  const produto = listaProdutos.find(p => p.id === id);
  const imagensDoProduto = document.querySelectorAll(`#imagem-produto-${id}`);

  imagensDoProduto.forEach(imagem => {
    let atual = Number(imagem.getAttribute("data-imagem-atual"));
    atual--;

    if (atual < 0) {
      atual = produto.imagens.length - 1;
    }

    imagem.src = produto.imagens[atual];
    imagem.setAttribute("data-imagem-atual", atual);
  });
}

function produtosRecomendadosAleatorios(produtoAtualId) {
  return listaProdutos
    .filter(produto => 
      produto.id !== produtoAtualId &&
      produto.recomendado === true &&
      (produto.nivelPreco === "baixo" || produto.nivelPreco === "medio")
    )
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
}