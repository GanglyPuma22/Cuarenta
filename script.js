import Deck from "./deck.js"
import { freshDeck } from "./deck.js";

var deck = new Deck(freshDeck());
var player1 = new Deck([]);
deck.shuffle();
deck.drawCards(5, player1);

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * 
charactersLength));
 }
 return result;
}

const createGameBtn = document.querySelector("button[name='create']");
const joinGameBtn = document.querySelector("button[name='join']");
const gameSessionBtn = document.querySelector("button[name='create-session'");
const joinSessionInp = document.querySelector("input[name='join-session'");

//Show option to create a game
createGameBtn.addEventListener("click", function() {
  console.log("hello");
  document.getElementById("choose-game-creation-option").style.display = "none";
  document.getElementById("create-game").style.display = "block";
  //document.getElementsByClassName("user-hand").item(0).style.display = "block";
  //showCards(player1);
});

//Show option to join a game
joinGameBtn.addEventListener("click", function() {
  document.getElementById("choose-game-creation-option").style.display = "none";
  document.getElementById("join-game").style.display = "block";
  //document.getElementsByClassName("user-hand").item(0).style.display = "block";
  //showCards(player1);
});



(function () {
  let playerId;
  let playerRef;

  //Use function to create teams in firebase once everyone has joined the game
  function initGame() {
    const allPlayersRef = firebase.database().ref(`players`);
    const allTeamsRef = firebase.database().ref('teams');
  }
  
  let players = {};
  let team1 = {};
  let team2 = {};
  
  //Show option to create a game session for host
  gameSessionBtn.addEventListener("click", function() {
    var gameId = makeid(20);
    let gameSessionRef = firebase.database().ref('gameSession/'+gameId);

    //Create game session
    gameSessionRef.set({
      id: gameId,
      playerCount: 1
    });
    
    //Add player to game session's players
    let newPlayerRef = firebase.database().ref(`gameSession/${gameId}/sessionPlayers`);
    newPlayerRef.push().set({
      playerId: playerId
    });

    //Get current game session player count data
    let playerCountRef = firebase.database().ref('gameSession/'+gameId+'/playerCount');

    //Fires whenever a change occurs
    playerCountRef.on("value", (snapshot) => {
      //Update game host's playerCount
      document.getElementById("player-count").innerHTML = "   Player Count: " + snapshot.val();
    })

    //Resolve promise 
    playerCountRef.get().then(function() {
      return playerCountRef.once("value");
    }).then(function(snapshot) {
      //Show key to game session creator and hide button that created game
      document.getElementById('create-game').style.display = "none";
      let showCreated = document.getElementById("create-game-id-created");
      showCreated.style.display = "block";
      const para1 = document.createElement("p");
      const para2 = document.createElement("p");
      const para3 = document.createElement("p");
      para1.innerHTML = "   Game Session ID is: " + gameId;
      para2.innerHTML = "   Share your game session ID to three other players. Once all four are connected the game will start.";
      para3.innerHTML = "   Player Count: " + snapshot.val();
      para3.setAttribute("id", "player-count");
      showCreated.appendChild(para1);
      showCreated.appendChild(para2);
      showCreated.appendChild(para3);
      //Start Game
    });

  });

  joinSessionInp.addEventListener("change", function() {
    //TODO Improve how we determine the sessionID is valid, right now it just makes sure its the right length for 1
    if (joinSessionInp.value.length == 20) {
      let sessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      let gameSessionJoinRef = firebase.database().ref('gameSession/'+joinSessionInp.value+'/sessionPlayers');
      let playerCountRef = firebase.database().ref('gameSession/'+joinSessionInp.value+'/playerCount');

      //Resolve promise getting current player count data
      playerCountRef.get().then(function() {
        return playerCountRef.once("value");
      }).then(function(snapshot) {
      let currentPlayerCount = snapshot.val();
      //If session isn't full add player to it
      if (currentPlayerCount < 4) {
        //Add this player to gameSession's players
        gameSessionJoinRef.push().set({
          playerId: playerId
        });
        //Update player count
        sessionRef.update({
          playerCount: currentPlayerCount + 1
        })
      } else {
        console.log("GAME FULL");
      }

      if (currentPlayerCount + 1 == 4) {
        console.log(currentPlayerCount);
        console.log("START GAME");
        //Start Game
      }
      });
    }
    // if (joinSessionInp.value == )
  });


  //After login this function triggers
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      //You're logged in!
      playerId = user.uid;
      playerRef = firebase.database().ref(`players/${playerId}`);
      //var playerName = "John";

      playerRef.set({
        id: playerId
      })

      //Remove me from Firebase when I diconnect
      playerRef.onDisconnect().remove();
      firebase.database().ref('gameSession').onDisconnect().remove();
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


function showCards(playerdeck) {
  for (let i = 0; i < playerdeck.numberOfCards; i++) {
    const userHandDiv = document.querySelector(".user-hand");
    //htmlImage = player1.cards[i].createHTML();
    // htmlImage.addEventListener("click", () => {
    //    console.log(player1.cards[i].value);
    //  });
    userHandDiv.appendChild(playerdeck.cards[i].createHTML()); 
    
 }
}




