import Deck from "./deck.js"
import { freshDeck } from "./deck.js";

var deck = new Deck(freshDeck());
var player1 = new Deck([]);
deck.shuffle();
deck.drawCards(5, player1);

const createGameBtn = document.getElementById("choose-game-creation-option").children.item(0);
const joinGameBtn = document.getElementById("choose-game-creation-option").children.item(1);
const joinLobbyBtn = document.getElementById("join-game-screen").children.item(4);
const createLobbyBtn = document.getElementById("create-game-screen").children.item(4);


//Handle creating a game
createGameBtn.addEventListener("click", function() {
  console.log("Hello there");
  document.getElementById("choose-game-creation-option").style.display = "none";
  document.getElementById("create-game-screen").style.display = "block"
});

//Handle joining a game
joinGameBtn.addEventListener("click", function() {
  console.log("Hello there");
  document.getElementById("choose-game-creation-option").style.display = "none";
  document.getElementById("join-game-screen").style.display = "block"
});

joinLobbyBtn.addEventListener("click", function() {
  console.log("Hello there");
  document.getElementById("join-game-screen").style.display = "none";
  document.getElementsByClassName("user-hand").item(0).style.display = "block";
  showCards(player1);
});

createLobbyBtn.addEventListener("click", function() {
  console.log("Hello there");
  document.getElementById("create-game-screen").style.display = "none";
  document.getElementsByClassName("user-hand").item(0).style.display = "block";
  showCards(player1);
});

(function () {
  let playerId;
  let playerRef;
  let players = {};
  let team1 = {};
  let team2 = {};

   firebase.auth().onAuthStateChanged((user) => {
    console.log(user)
    if (user) {
      //You're logged in!
      playerId = user.uid;
      playerRef = firebase.database().ref(`players/${playerId}`);
      var playerName = "John";

      playerRef.set({
        id: playerId,
        name: playerName
      })

      //Remove me from Firebase when I diconnect
      playerRef.onDisconnect().remove();
      //players.
      //Begin the game now that we are signed in
      //initGame();
    } else {
      //You're logged out.
    }
  })

  //Auth error log 
  firebase.auth().signInAnonymously().catch((error) => {
    var errorCode = error.code;
    var errorMessage = error.message;
    // ...
    console.log(errorCode, errorMessage);
  });

})();

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

const imageTest = document.querySelector(".test");
const userHandDiv = document.querySelector(".user-hand");
function showCards(playerdeck) {
  for (let i = 0; i < playerdeck.numberOfCards; i++) {
    //htmlImage = player1.cards[i].createHTML();
    // htmlImage.addEventListener("click", () => {
    //    console.log(player1.cards[i].value);
    //  });
    userHandDiv.appendChild(playerdeck.cards[i].createHTML()); 
    
 }
}




