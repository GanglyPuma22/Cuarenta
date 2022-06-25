import Card from "./card.js";
import Deck from "./deck.js"
import { freshDeck } from "./deck.js";

const gameSessionBtn = document.querySelector("button[name='create-session'");
const joinSessionBtn = document.querySelector("button[name='join-session'");
const joinSessionInp = document.querySelector("input[name='join-session'");

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

  let board = {};

  let playerHand; //database does not need player hand info

  //Function initiates watching variables changes for both host and members
  function initRefs() {

    //Update local board var when board value changes
    gameSessionRef.child('board').on("value", (snapshot) => {
      board = snapshot.val() || {};
    });

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
    gameSessionRef.onDisconnect().remove();
    let username = document.querySelector("input[name='create-name'").value
    playerRef.update({
      name: username
    })
    
    //Create game session
    gameSessionRef.set({
      id: gameId,
      playerCount: 1,
      gameState: 'lobby',
      currentPlayer: playerId //game host starts game
    });

    //Create event listener for start game btn
    document.getElementById('start-game-btn').addEventListener('click', function() {
      //Create teams, vars team1 and team2 store them in db
      //Also sets up player cards
      createTeams();
      console.log(team1);
      console.log(team2);
      gameSessionRef.update({
        team1: team1,
        team2: team2,
        gameState: 'started'
      });

      //Hide game host and show user hand and cards
      document.getElementById("game-host").style.display = "none";
      console.log(playerCards);
      showCards(playerCards);
    });

    //Show key to game session creator and hide button that created game
    document.getElementById('create-game').style.display = "none";
    let showCreated = document.getElementById("create-game-id-created");
    document.getElementById('game-id-host').innerHTML = "Game Session ID is: " + gameId;

    //Show the three paragraphs
    showCreated.style.display = "block";

    //Add player to game session's players
    let newPlayerRef = firebase.database().ref(`gameSession/${gameId}/sessionPlayers`);
    newPlayerRef.child(playerId).set({
      playerId: playerId,
      name: username
    });

    //Updates local variable players with data every time players gets updated
    newPlayerRef.on("value", (snapshot) => {
      players = snapshot.val() || {}; //Fires whenever a change occurs
    })

    //Get current game session player count data
    let playerCountRef = firebase.database().ref('gameSession/'+gameId+'/playerCount');

    //Fires whenever a change occurs to playerCount for current game session
    playerCountRef.on("value", (snapshot) => {

      let oldList = document.getElementById('playerList');
      if (oldList) {
        oldList.remove(); //Remove old list
      }
      
      const para2 = document.createElement("table");
      para2.setAttribute('id', 'playerList');
      showCreated.appendChild(para2); //Add new Table

      Object.keys(players).forEach((key) => { //Fill list with player names
        let row = document.createElement("tr")
        let value = document.createElement("td")
        row.appendChild(value);
        row.setAttribute('value', players[key].playerId);
        value.innerHTML = players[key].name;
        para2.appendChild(row);
      });

      if (para2.hasChildNodes()) {
        console.log("Para 2 has chldren");
        para2.childNodes.forEach((child) => {
          console.log(child);
          child.addEventListener('click', function() {
            if (child.getAttribute('style') == '') {
              console.log('no color');
              child.setAttribute('style', 'background-color:red');
            } else if (child.getAttribute('style') == 'background-color:red') {
              child.setAttribute('style', 'background-color:blue');
            } else {
              child.setAttribute("style", "");
            }
          });
        });
      }
      

      //Update game host's playerCount
      let playerCountEl = document.getElementById("player-count-host")

      if (playerCountEl && snapshot.val() < 5) { //Check not null and player count no more than 5
        playerCountEl.innerHTML = "   Player Count: " + snapshot.val();
      }
      if (snapshot.val() == playerLimit) { //Start game conditions met
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
        
        document.getElementById('start-game-btn').style.display = 'block';

      }
    })

  });

  joinSessionBtn.addEventListener("click", function() {
    //TODO Improve how we determine the sessionID is valid, right now it just makes sure its the right length for 1
    
    if (joinSessionInp.value.length == 20) {
      //let sessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      let gameID = joinSessionInp.value
      gameSessionRef = firebase.database().ref('gameSession/'+ gameID);
      let gameSessionJoinRef = firebase.database().ref('gameSession/'+ gameID +'/sessionPlayers');
      let playerCountRef = firebase.database().ref('gameSession/'+ gameID +'/playerCount');

      document.getElementById("pre-join").style.display = "none"; //Hide pre join inputs
      document.getElementById("post-join").style.display = "block"; //Show post join information

      let username = document.querySelector("input[name='join-name'").value;
      playerRef.update({
        name: username
      });

      //Create listener for game to start
      gameSessionRef.child('gameState').on("value", (snapshot) => {
        console.log('INSIDE GAME STATE');
        console.log(snapshot.val());
        if (snapshot.val() == 'started') {
          console.log("START GAME");
          //Hide game host and show user hand and cards
          document.getElementById("game-host").style.display = "none";
          //Setup database change events to be used later 
          initRefs();
          setTimeout(() => { showCards(playerCards);}, "4000") //Give members time for database to sync with host 
        
          document.querySelector('.user-hand').children.onmousedown = startDrag; //Set event listener for dragging cards
          document.querySelector('.user-hand').children.onmouseup = stopDrag;
        }
      })

      //Updates local variable players with data every time players gets updated
      gameSessionJoinRef.on("value", (snapshot) => { //Fires whenever a change occurs
        players = snapshot.val() || {};
      });

      //Fires whenever a change occurs to playerCount for current game session
      playerCountRef.on("value", (snapshot) => { 
        let joinGameDiv = document.getElementById("post-join");
        let oldList = document.getElementById('playerList');

        if (oldList) {
          oldList.remove(); //Remove old list
        }
        
        const para2 = document.createElement("ol");
        para2.setAttribute('id', 'playerList')
        joinGameDiv.appendChild(para2); //Add new List

        Object.keys(players).forEach((key) => { //Fill list with player names
          let para = document.createElement("li")
          para.innerHTML = players[key].name;
          para2.appendChild(para)
        });
        
        //Update joining user's playerCount
        let playerCountEl = document.getElementById("player-count-member");
        if (playerCountEl && snapshot.val() < 5) { //Check not null and player count at most 4
          playerCountEl.innerHTML = "Player Count: " + snapshot.val();
        }

        if (snapshot.val() == playerLimit) {
          document.getElementById('waiting-on-game').style.display = 'block';
        }
      });
      
      //Resolve promise getting current player count data
      playerCountRef.get().then(function() {
        return playerCountRef.once("value");
      }).then(function(snapshot) {
      let currentPlayerCount = snapshot.val(); //Player count before adding the user pressing this
      //If session isn't full add player to it
      if (currentPlayerCount < 4) {
        //Add this player to gameSession's players
        gameSessionJoinRef.child(playerId).set({
          playerId: playerId,
          name: username
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
  });

  /**
   * HELPERS FOR INSIDE FIREBASE FUNCTION
   */
  function createTeams() {
    let table = document.getElementById('playerList');
    let counter = 0;
    table.childNodes.forEach((child) => { //Iterate over player table elements
      if (child.getAttribute('style') == 'background-color:red') {
        if (team1.player1) {
          team1.player2 = players[child.getAttribute('value')];
          team1.player2.cards = deck2.getCards();
        } else {
          team1.player1 = players[child.getAttribute('value')];
          team1.player1.cards = deck1.getCards();
        }
      } else if (child.getAttribute('style') == 'background-color:blue') {
        if (team2.player1) {
          team2.player2 = players[child.getAttribute('value')];
          team2.player2.cards = deck4.getCards();
        } else {
          team2.player1 = players[child.getAttribute('value')];
          team2.player1.cards = deck3.getCards();
        }
      }
    });
  }

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
    } else {
      //You're logged out.
    }
  })

  //Auth error log 
  firebase.auth().signInAnonymously().catch((error) => {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log(errorCode, errorMessage);
  });

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

  function showCards(playerdeck) {
    const userHandDiv = document.querySelector(".user-hand");
    //let counter = 0;
    for (let i = 0; i < 5; i++) {
      let card = new Card(playerdeck[i].suit, playerdeck[i].value);
      let image = card.createHTML();
      image.onmousedown = startDrag;
      image.onmouseup = stopDrag;
      userHandDiv.appendChild(image);
    }
   userHandDiv.style.display = "block";
  }
  
  
  let startingX;
  let startingY;
  let offsetX;
  let offsetY;
  let coordX;
  let coordY;
  let drag;
  let targ;
  
  function startDrag(e) {
    console.log(e);
    // determine event object
    if (!e) {
        var e = window.event;
    }
    if(e.preventDefault) e.preventDefault();
  
    // IE uses srcElement, others use target
    targ = e.target ? e.target : e.srcElement;
  
    if (targ.className != 'card') {return};
    // Save starting values of cards x y coords
      startingX = targ.style.left;
      startingY = targ.style.top;
    // calculate event X, Y coordinates
      offsetX = e.clientX;
      offsetY = e.clientY;
  
    // assign default values for top and left properties
    if(!targ.style.left) { targ.style.left='0px'};
    if (!targ.style.top) { targ.style.top='0px'};
  
    // calculate integer values for top and left 
    // properties
    coordX = parseInt(targ.style.left);
    coordY = parseInt(targ.style.top);
    drag = true;
  
    // move div element
        document.onmousemove=dragDiv;
    return false;
  
  }
  
  function dragDiv(e) {
    if (!drag) {return};
    if (!e) { var e= window.event};
    // var targ=e.target?e.target:e.srcElement;
    // move div element
    targ.style.left=coordX+e.clientX-offsetX+'px';
    targ.style.top=coordY+e.clientY-offsetY+'px';
    return false;
  }
  
  function stopDrag() {
    if (playerTurnID == playerId) {
      let position = document.getElementById('board').getBoundingClientRect();
      let imgPos = targ.getBoundingClientRect();
  
      if ((parseFloat(imgPos.left) > parseFloat(position.left) && parseFloat(imgPos.left) < parseFloat(position.left) + (parseFloat(position.width) - parseFloat(imgPos.width))) &&
          (parseFloat(imgPos.top) > parseFloat(position.top) && parseFloat(imgPos.top) < parseFloat(position.top) + (parseFloat(position.height) - imgPos.height))) {
          drag = false;
          board.testFields = 'success';
          //Add card to board in firebase
          gameSessionRef.child('board').update(board);
  
      } else {
        targ.style.left = startingX;
        targ.style.top = startingY;
        drag = false;
      }
  
    } else {
      targ.style.left = startingX;
      targ.style.top = startingY;
      drag = false;
    }
  }

  

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







