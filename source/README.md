# Croissant Plouf Saga

Ett fristående, offline-fungerande match 3-spel med franskt tema. Alla bilder, typsnitt och PWA-filer ingår lokalt i projektet — inga externa tjänster anropas.

## Spela direkt (mappen `site/`)

Mappen `site/` innehåller en färdigbyggd version med `index.html`. Ladda upp innehållet i `site/` till valfri statisk webbplats:

- **GitHub Pages**: skapa ett repo, lägg filerna från `site/` i roten (eller i `docs/` och välj docs som källa under Settings → Pages). Spelet fungerar även när det ligger i en undermapp, t.ex. `anvandarnamn.github.io/mitt-repo/`.
- **Valfri webbserver**: kopiera filerna och öppna sidan. Efter första besöket fungerar spelet offline (service worker cachar allt).

Observera: service worker och offline-läge kräver http(s) — öppna inte `index.html` via dubbelklick (file://), utan via en webbserver eller GitHub Pages.

## Development

Du behöver Node.js 20+ eller Bun.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

## Bygga själv

```sh
npm run build          # bygger till dist/
node scripts/patch-static.mjs   # gör sökvägarna portabla
```

Det färdiga resultatet ligger i `dist/client/` (motsvarar den medföljande `site/`-mappen).

Tester: `npx vitest run` · Lint: `npm run lint`

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
