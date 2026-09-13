# Croissant Plouf Saga

## Spela direkt
Dubbelklicka på `index.html` — spelet startar i webbläsaren utan server.

## Lägg upp på GitHub Pages
1. Ladda upp *innehållet* i den här mappen till repots rot (så att `index.html` ligger i roten).
2. Settings > Pages > Deploy from a branch > välj branch och `/ (root)`.
3. Öppna sidan, välj "Installera app" i webbläsaren för att köra den som app offline.

Inget i spelet hämtas från internet: bilder, typsnitt, musik och logik ligger i mappen.

## Källkod
All källkod ligger i `source/`. Bygg om med:

    npm install
    npm run build:static

Resultatet hamnar i `dist/static/` och är exakt det som ligger i roten här.
