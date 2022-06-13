import Deck from "./deck.js"
import { freshDeck } from "./deck.js";

const CARD_VALUE_MAP = {
   "2": 2,
   "3": 3,
   "4": 4,
   "5": 5,
   "6": 6,
   "7": 7,
   "J": 11,
   "Q": 12,
   "K": 13,
   "A": 14
}

var deck = new Deck(freshDeck());
var player1 = new Deck([]);
deck.shuffle();
deck.drawCards(5, player1);


const imageTest = document.querySelector(".test");
const userHandDiv = document.querySelector(".user-hand");

for (let i = 0; i < player1.numberOfCards; i++) {
   //htmlImage = player1.cards[i].createHTML();
   // htmlImage.addEventListener("click", () => {
   //    console.log(player1.cards[i].value);
   //  });
   userHandDiv.appendChild(player1.cards[i].createHTML()); 
   
}

