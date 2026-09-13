import "../src/styles.css";
import "../src/game/game.css";
import { GAME_MARKUP } from "../src/game/markup.js";
import { startGame } from "../src/game/runtime.js";

const game = document.querySelector("#game");

if (game) {
  game.innerHTML = GAME_MARKUP;
  startGame();
}

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js");
  });
}