import Card from "./card.js";
import Deck from "./deck.js"
import { freshDeck } from "./deck.js";



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
const joinSessionBtn = document.querySelector("button[name='join-session'");
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
  //Database vars
  let playerId;
  let playerRef;
  let boardRef;
  let deckRef;
  let cardsRef;
  let gameSessionRef;

  //Storage vars
  let players = {};
  let dbDeck = {};
  let cardNum = 0;
  let team1 = {};
  let team2 = {};
  let playerCards = {};
  let playerLimit = 4;
  let playerTurnID; //Keeps track of player ID who's current turn it is

  //Class variables 
  let deck = new Deck(freshDeck()); //Create game deck
  deck.shuffle(); //Shuffle it
  let deck1;
  let deck2;
  let deck3;
  let deck4;

  let board;

  let playerHand; //database does not need player hand info

  function createTeams() {
    let counter = 0;
    Object.keys(players).forEach((key) => {
      //console.log(players[key].playerId);
      if (counter == 0) { 
        team1.player1 = players[key];
        team1.player1.cards = deck1.getCards();
        counter++;
      } else if (counter == 1) {
        team1.player2 = players[key];
        team1.player2.cards = deck2.getCards();
        counter++;
      } else if (counter == 2) {
        team2.player1 = players[key];
        team2.player1.cards = deck3.getCards();
        counter++;
      } else if (counter == 3) {
        team2.player2 = players[key];
        team2.player2.cards = deck4.getCards();
        counter++;
      } 
    });
  }


  //Function initiates watching variables changes for both host and members
  function initRefs() {
    //Updates local var playerTurnID everytime it gets updates in db
    gameSessionRef.child('currentPlayer').on("value", (snapshot) => {
      playerTurnID = snapshot.val() || "";
    });

    //Next two refs check for team1 and team2 value to be set and set playerCards to be current player's cards from database
    gameSessionRef.child('team1').on("value", (snapshot) => {
      if (snapshot.val()) {
        let teamVar = snapshot.val() || {};
        if (teamVar.player1.playerId == playerId) {
          playerCards = teamVar.player1.cards;
        } else if (teamVar.player2.playerId == playerId) {
          playerCards = teamVar.player2.cards;
        }
        console.log("player cards are: ")
        console.log(playerCards);
      }
    });
    gameSessionRef.child('team2').on("value", (snapshot) => {
      if (snapshot.val()) {
        let teamVar = snapshot.val() || {};
        if (teamVar.player1.playerId == playerId) {
          playerCards = teamVar.player1.cards;
        } else if (teamVar.player2.playerId == playerId) {
          playerCards = teamVar.player2.cards;
        }
        console.log("player cards are: ")
        console.log(playerCards);
      }
    });

  }
  
  //Show option to create a game session for host
  gameSessionBtn.addEventListener("click", function() {
    var gameId = makeid(20);
    gameSessionRef = firebase.database().ref('gameSession/'+gameId);
    //deckRef = firebase.database().ref('gameSession/'+gameId+'/deck');

    let username = document.querySelector("input[name='create-name'").value
    console.log(username)
    playerRef.update({
      name: username
    })
    
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

    //Updates local variable players with data every time players gets updated
    newPlayerRef.on("value", (snapshot) => {
      //Fires whenever a change occurs
      players = snapshot.val() || {};
    })

    //Get current game session player count data
    let playerCountRef = firebase.database().ref('gameSession/'+gameId+'/playerCount');

    //Fires whenever a change occurs to playerCount for current game session
    playerCountRef.on("value", (snapshot) => {
      //Update game host's playerCount
      let playerCountEl = document.getElementById("player-count-host")

      
      if (playerCountEl && snapshot.val() < 5) { //Check not null and player count no more than 5
        playerCountEl.innerHTML = "   Player Count: " + snapshot.val();
      }
      if (snapshot.val() == playerLimit) {
        console.log("START GAME");
        deck1 = new Deck([]);
        deck2 = new Deck([]);
        deck3 = new Deck([]);
        deck4 = new Deck([]);
        deck.drawCards(10, deck1);
        deck.drawCards(10, deck2);
        deck.drawCards(10, deck3);
        deck.drawCards(10, deck4);

       //create references
        initRefs();

        //Create teams, vars team1 and team2 store them in db
        //Also sets up player cards
        createTeams();
        gameSessionRef.update({
          team1: team1,
          team2: team2
        });

        //Hide game host and show user hand and cards
        document.getElementById("game-host").style.display = "none";
        showCards(playerCards);

      }
    })

    //Show key to game session creator and hide button that created game
    document.getElementById('create-game').style.display = "none";
    let showCreated = document.getElementById("create-game-id-created");
    //Initialize text to show game creator
    const para1 = document.createElement("p");
    const para2 = document.createElement("p");
    const para3 = document.createElement("p");
    para3.setAttribute("id", "player-count-host"); //ID needs to be set for playerCount change event listener
    para1.innerHTML = "Game Session ID is: " + gameId;
    para2.innerHTML = "Share your game session ID to three other players. Once all four are connected the game will start.";
    para3.innerHTML = "Player Count: 1";
    const para4 = document.createElement("ol");
    const para5 = document.createElement("li");
    para5.innerHTML = username
    showCreated.appendChild(para1);
    showCreated.appendChild(para2);
    showCreated.appendChild(para3);
    showCreated.appendChild(para4);
    para4.append(para5)
    //Show the three paragraphs
    showCreated.style.display = "block";

  });

  joinSessionBtn.addEventListener("click", function() {
    //TODO Improve how we determine the sessionID is valid, right now it just makes sure its the right length for 1
    
    if (joinSessionInp.value.length == 20) {
      //let sessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      let gameID = joinSessionInp.value
      gameSessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      let gameSessionJoinRef = firebase.database().ref('gameSession/'+joinSessionInp.value+'/sessionPlayers');
      let playerCountRef = firebase.database().ref('gameSession/'+joinSessionInp.value+'/playerCount');
      let playersRef = firebase.database().ref('players/')

      //Display text for user
      const para1 = document.createElement("p");
      const playerCountParaEl = document.createElement("p");
      para1.innerHTML = "Successfully joined the game. Waiting on four players";
      playerCountParaEl.innerHTML = "Player Count:";
      playerCountParaEl.setAttribute("id", "player-count-member");
      document.getElementById("join-game").appendChild(para1);
      document.getElementById("join-game").appendChild(playerCountParaEl);

      document.getElementById("pre-join").style.display = "none"

      let username = document.querySelector("input[name='join-name'").value
      console.log(username)
      playerRef.update({
        name: username
      })

      const para2 = document.createElement("ol");
      document.getElementById("join-game").appendChild(para2);

      //Fires whenever a change occurs to playerCount for current game session
      playerCountRef.on("value", (snapshot) => {  
        
        gameSessionJoinRef.get().then(function() {
          return  gameSessionJoinRef.once("value");
        }).then(function(snapshot) {
          let current = snapshot.val(); 
          let iteration = 1
          Object.keys(current).forEach((key) => {
            let id = firebase.database().ref(`gameSession/${gameID}/sessionPlayers/${key}/playerId/`)
            //
            console.log(iteration)
            iteration += 1
            id.get().then(function() {
              return id.once("value");
            }).then(function(snapshot) {
              let playerId = snapshot.val();
              let nameRef = firebase.database().ref(`players/${playerId}/name/`)
              
              nameRef.get().then(function() {
                return nameRef.once("value");
              }).then(function(snapshot) {
                let name = snapshot.val();
                console.log(name)                
              });
            });
          }); 
          });
        
        //Update joining user's playerCount
        let playerCountEl = document.getElementById("player-count-member");
        if (playerCountEl && snapshot.val() < 5) { //Check not null and player count at most 4
          playerCountEl.innerHTML = "Player Count: " + snapshot.val();
        }
        if (snapshot.val() == playerLimit) {
          console.log("START GAME");
          initRefs();
          //Hide game host and show user hand and cards
          document.getElementById("game-host").style.display = "none";
          setTimeout(() => {  showCards(playerCards); }, 5000); //Give members time for database to sync with host
  

          //initGameMember();
      }
      })

      //Resolve promise getting current player count data
      playerCountRef.get().then(function() {
        return playerCountRef.once("value");
      }).then(function(snapshot) {
      let currentPlayerCount = snapshot.val(); //Player count before adding the user pressing this
      //If session isn't full add player to it
      if (currentPlayerCount < 4) {
        //Add this player to gameSession's players
        gameSessionJoinRef.push().set({
          playerId: playerId
        });
        //Update player count
        gameSessionRef.update({
          playerCount: currentPlayerCount + 1
        })
      } else {
        console.log("GAME FULL");
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
  const userHandDiv = document.querySelector(".user-hand");
  //let counter = 0;
  for (let i = 0; i < 5; i++) {
    let card = new Card(playerdeck[i].suit, playerdeck[i].value);
    userHandDiv.appendChild(card.createHTML());
  }
//  Object.keys(playerdeck).forEach((key) => {
//   console.log(key);
//   if (counter < 5) {
//     userHandDiv.appendChild(playerdeck[key].createHTML());
//   }
//   counter++;
//  });

 userHandDiv.style.display = "block";
}




