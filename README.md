# Órbita (Etapa 1)
App pessoal estático (PWA). Sem build: basta subir os arquivos.

## Publicar no GitHub Pages
1. No GitHub: **New repository** → nome (ex.: `orbita`) → **Create**.
2. **Add file → Upload files** → arraste TODO o conteúdo desta pasta (inclusive `.nojekyll`, `css/`, `js/`, `icons/`) → **Commit**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, pasta `/ (root)` → **Save**.
4. Aguarde 1–2 min e abra `https://SEU-USUARIO.github.io/orbita/`.

## Instalar
- Android (Chrome): menu ⋮ → *Instalar app*. iPhone (Safari): Compartilhar → *Adicionar à Tela de Início*. Computador (Chrome/Edge): ícone de instalar na barra de endereço.

## Atualizações
Ao mudar arquivos, altere `V` em `sw.js` (ex.: `orbita-v2`) para renovar o cache offline.
