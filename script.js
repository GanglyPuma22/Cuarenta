import Deck from "./deck.js"
import Card from "./card.js"

const deck = new Deck();
deck.shuffle();
console.log(deck);

const imageTest = document.querySelector(".test");
// const card = new Card("♣","2");
// console.log(card.suitToText());
// console.log(card.createHTML());

for (let i = 0; i < deck.numberOfCards; i++) {
   imageTest.appendChild(deck.cards[i].createHTML());
}
