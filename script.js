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
  let playerHand = new Deck([]); //database does not need player hand info

  function createTeams() {
    let counter = 0;

    Object.keys(players).forEach((key) => {
      //console.log(players[key].playerId);
      if (counter == 0) { 
        team1.player1 = players[key];
        team1.player1.cards = deck1;
        counter++;
      } else if (counter == 1) {
        team1.player2 = players[key];
        team1.player2.cards = deck2;
        counter++;
      } else if (counter == 2) {
        team2.player1 = players[key];
        team2.player1.cards = deck3;
        counter++;
      } else if (counter == 3) {
        team2.player2 = players[key];
        team2.player2.cards = deck4;
        counter++;
      } 
    });
  }

  // function drawAllCards() {
  //   let index = 0;
  //   let counter = 0;
  //   let playerCount = 1;

  //   let team1Ref = gameSessionRef.child('team1');
  //   let team2Ref = gameSessionRef.child('team2');
  //   let currentCards = {};

  //   Object.keys(dbDeck).forEach((key) => {
  //     if (index <= 9) {
  //       currentCards.counter = key;
  //     }
  //     if (counter == 9) { 
  //       counter = 0; 
  //       if (playerCount == 1) {
  //         team1Ref.child('player1').update{
  //           cards = currentCards
  //         }
  //         playerCount++;
  //       } else if (playerCount == 2) {
  //         team1
  //       }
        
  //     }
  //   });
  // }


  //Function initiates watching variables changes for both host and members
  function initRefs() {
    //Updates local var playerTurnID everytime it gets updates in db
    gameSessionRef.child('currentPlayer').on("value", (snapshot) => {
      playerTurnID = snapshot.val() || "";
    });


    //deckRef = gameSessionRef.child('deck');
    cardsRef = gameSessionRef.child('deck').child('cards');
    //cardIndexRef = gameSessionRef.child('cardIndex');

    //Updates local var dbDeck with databases deck, allows us to store draw cards
    // cardsRef.on("value", (snapshot) => {
    //   dbDeck = snapshot.val() || {}; 
    //   cardNum = Object.keys(dbDeck).length;
    //   //cardNum = Object.keys(dbDeck).length; //save number of cards in deck
    //   console.log(dbDeck);
    //   console.log("number of cards is: ");
    //   console.log(cardNum);
    //   if (cardNum != 0 && playerHand.numberOfCards < 5) {
    //     //for (let i = 0; i < 5; i++) {
    //       let cardRef = cardsRef.child((cardNum-1).toString());
    //       console.log(cardRef.toString());
    //       cardRef.get().then(function() {
    //         return cardRef.once("value");
    //       }).then(function(snapshot) {
    //         let currentCard = snapshot.val(); //Player count before adding the user pressing this
    //         console.log("card is: ");
    //         console.log(snapshot.val());
    //         playerHand.add(currentCard.suit, currentCard.value);
    //       });
          
    //     //}
    //   }
    // });

    // cardsRef.on('child_removed', () => {
    //   cardNum = cardNum - 1;
    //   console.log("number of cards is: ");
    //   console.log(cardNum);
    // });

  }

  function initGameMember() {
    //initRefs();
    playerHand = new Deck([]);
    //console.log("Checking if deck is null");
    //console.log(deck);
    console.log(Object.keys(dbDeck).length);
    if (Object.keys(dbDeck).length != 0) { //make sure deck isnt null
      //let currentCardsRef = gameSessionRef.child('deck').child('cards');
      console.log(cardsRef.toString());
      //console.log(deckRef.child('cards').toString());

      for (let i = 1; i < 6; i++) {
        let cardRef = cardsRef.child((cardNum-i).toString());
        console.log(cardRef.toString());
        cardRef.get().then(function() {
          return cardRef.once("value");
        }).then(function(snapshot) {
          let currentCard = snapshot.val(); //Player count before adding the user pressing this
          console.log("card is: ");
          console.log(snapshot.val());
          playerHand.add(currentCard.suit, currentCard.value);
          cardRef.remove().then(function() {
            console.log("Remove succeeded.")
          }); 
        });
      }

      //deck.drawCards(5, playerHand);
      console.log("Joined Player Hand");
      console.log(playerHand);

      //Update deck in database
      //gameSessionRef.update({
        //deck : deck
      //})

    }
  }

  //Use function to create teams in firebase once everyone has joined the game
  function initGameHost() {
    //Set up references 
    //Check for 4 players in on value change reference below
    //Call this function there to setup deck, give cards to players from deck
    //Create deck in database and here constantly updating it using on value changes 
    //Set up html visuals handling the card back showing up, deck counter and player cards showingUp
    //Set up deck on child removed update card count
    //initRefs();

    //Create deck storing current cards on board;
    board = new Deck([]);
    //Create user's card deck
    playerHand = new Deck([]);
    deck.drawCards(5, playerHand);
    console.log("Host hand: ");
    console.log(playerHand);

    

    //Set starting player - playing order will be team1 -p1, team1 -p2, team2 -p1, team2 -p2
    //playerTurnID = team1.player1.playerId;    
    //Store current player in database
    gameSessionRef.update({
      currentPlayer: team1.player1.playerId
    })


    // gameSessionRef.child('currentPlayer').on("value", (snapshot) => {
    //   playerTurnID = snapshot.val();
    // });

    console.log(team1);
    console.log(team2);
    //deck.drawCards(5, playerHand);
  }
  
  
  //Show option to create a game session for host
  gameSessionBtn.addEventListener("click", function() {
    var gameId = makeid(20);
    gameSessionRef = firebase.database().ref('gameSession/'+gameId);
    //deckRef = firebase.database().ref('gameSession/'+gameId+'/deck');

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
      let playerCountEl = document.getElementById("player-count-host");
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

        //Create deck
        // gameSessionRef.update({
        //   deck,
        //   cardIndex: 0
        // })

        //Assign cards to players


        //Create teams
        initRefs();

        //Create teams, vars team1 and team2 store them in db
        //Also sets up cards
        createTeams();
        gameSessionRef.update({
          team1: team1,
          team2: team2
        });

        //drawAllCards();
        //initGameHost();
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
    showCreated.appendChild(para1);
    showCreated.appendChild(para2);
    showCreated.appendChild(para3);
    //Show the three paragraphs
    showCreated.style.display = "block";

  });

  joinSessionInp.addEventListener("change", function() {
    //TODO Improve how we determine the sessionID is valid, right now it just makes sure its the right length for 1
    if (joinSessionInp.value.length == 20) {
      //let sessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      gameSessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      let gameSessionJoinRef = firebase.database().ref('gameSession/'+joinSessionInp.value+'/sessionPlayers');
      let playerCountRef = firebase.database().ref('gameSession/'+joinSessionInp.value+'/playerCount');


      //Display text for user
      const para1 = document.createElement("p");
      const playerCountParaEl = document.createElement("p");
      para1.innerHTML = "Successfully joined the game. Waiting on four players";
      playerCountParaEl.innerHTML = "Player Count:";
      playerCountParaEl.setAttribute("id", "player-count-member");
      document.getElementById("join-game").appendChild(para1);
      document.getElementById("join-game").appendChild(playerCountParaEl);

      //Fires whenever a change occurs to playerCount for current game session
      playerCountRef.on("value", (snapshot) => {
        //Update joining user's playerCount
        let playerCountEl = document.getElementById("player-count-member");
        if (playerCountEl && snapshot.val() < 5) { //Check not null and player count at most 4
          playerCountEl.innerHTML = "Player Count: " + snapshot.val();
        }
        if (snapshot.val() == playerLimit) {
          console.log("START GAME");
          initRefs();
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


      // if (currentPlayerCount + 1 == 4) {
      //   console.log(currentPlayerCount);
      //   console.log("START GAME");
      //   //Start Game
      //   initGame();
      // }
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




