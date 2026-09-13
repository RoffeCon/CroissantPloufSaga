# Croissant Plouf Saga – roadmap

## Klart

- Bilderna ut ur HTML-filen (39 st) → egna tillgångsfiler, ingen base64
- Spelet uppdelat i moduler: engine (ren logik), runtime (kontroll), markup, css, assets
- PWA: manifest, ikoner (192/512/maskable), apple-touch-icon, temafärg
- Färgbomb (5 i rad), stjärnbetyg 1–3, bonuspoäng för sparade drag
- Datamoduler skapade: `src/game/data/tiles.js`, `levels.js`, `regions.js`
  (monument per region, alla med riktiga bilder), `characters.js`
  (schema med tile/ability/unlock, de Gaulle förberedd), `strings.js`
- Runtime kopplad till datamodulerna — inga inbäddade tabeller kvar i `runtime.js`
- Vitest-tester (35 st) för matchning, specialbrickor och specialkombinationer,
  resultatuträkning, gravitation, förflyttning och datamodulernas samspel
- Riktiga monumentbilder för alla 18 regioner (12 nya i samma sagoboksstil)
- Regionfest: trikolorbanderoll, monument som byggs klart med byggnadsställning,
  fanfar, konfetti, vibration, regionräknare och poängsumma
- Tydligt regionval direkt på kartan, med aktivt val att spela utan regionmål
- Sparad data v3 med migrering av äldre sparningar och samlade inställningar
- Intjänade boosters: extra drag, gratis blandning och borttagning av bricka
- Tangentbordsstyrning, fokusmarkeringar och stöd för reducerad rörelse
- Fransk cafévals, regionfanfarer och Marseljäsen efter hela Frankrike
- Fristående PWA med lokala bilder, lokala typsnitt och offline-cache
- Gränssnittsöversyn med större tryckytor och tydligare knappar

## Genomfört från ursprungslistan

1. ~~Tydligt regionval direkt på den illustrerade kartan, inklusive aktivt val att spela utan regionmål~~ KLAR
2. ~~Specialbrickor~~ KLAR: T/L-form (3×3-områdesrensare) + kombinationer special+special
3. ~~Sparad data v3: en versionerad post, migrering från gamla nycklar, boosters~~ KLAR
4. ~~Resultatskärm~~ KLAR: mål, drag, bonus, regionframsteg och stjärnor
5. ~~Regionfest~~ KLAR: monumentet byggs klart med fanfar och sammanfattning
6. ~~Boosters intjänade i spelet (extra drag, blanda, ta bort bricka)~~ KLAR
7. ~~Mobil-UX~~ KLAR: brädet anpassas efter skärmhöjd (inget skrollande), tumvänliga knappar (48px), safe-area för notch/hemknapp, modaler skrollar på små skärmar, vibration med egen inställning, layout för smala/låga skärmar
8. ~~Tillgänglighet: tangentbordsstyrning av brädet, fokusmarkering, prefers-reduced-motion~~ KLAR
9. ~~Ljud/musik~~ KLAR: separata reglage (av/på + volym) för ljudeffekter och
   musik, bakgrundsvals i kaféstil som loopar, tystnar när fliken göms och
   dämpas under fanfar/Marseillaisen, haptik-abstraktion med eget reglage
10. ~~Offline: bilder helt lokala i projektet + service worker med cache~~ KLAR
11. ~~Monumentbilder~~ KLAR: inga platshållare kvar
12. ~~Franskare bakgrundsmusik; Marseljäsen endast när hela Frankrikes hjärtan har vunnits~~ KLAR
13. ~~Gränssnittsöversyn: tydligare navigation, större tryckytor, konsekventa knappar och bättre fokusmarkering~~ KLAR
14. ~~Fristående GitHub-/ZIP-version utan externa länkar, typsnitt eller CDN-beroenden~~ KLAR
