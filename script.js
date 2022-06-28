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

  let board = []; //Initialize board array that will store databse board info

  //Function initiates watching variables changes for both host and members
  function initRefs() {

    //Update local board var when board value changes
    gameSessionRef.child('board').on("value", (snapshot) => {
      board = snapshot.val() || [];
      //Draw cards for all players
      //if (playerId != playerTurnID) {
      let boardEl = document.getElementById('board');
      //Remove html children on board
      boardEl.childNodes.forEach((card) => {
        boardEl.removeChild(card);
      });
      
      //Redraw them
      for (let i = 0; i < board.length; i++) {
        let tempCard = new Card(board[i].suit, board[i].value);
        let imgEl = tempCard.createHTML();
        imgEl.style.left = board[i].x;
        imgEl.style.top = board[i].y;
        imgEl.style.height = '45%';
        imgEl.style.width = '19%';
        imgEl.setAttribute('class', 'board-card');
        if (i == board.length - 1) { //Last card in board array is last card played
          imgEl.style.border = '5px solid green';
          imgEl.style.borderRadius = '20px';
        }
        imgEl.setAttribute('intersected', 'false');
        // imgEl.ondragenter = handleCardEnter;
        // imgEl.ondragleave = handleCardLeave;
        // imgEl.ondragover = handleDrag;
        boardEl.appendChild(imgEl);
        
        //imgEl.position = 'absolute';
      }
      //}
    });

    //Updates local var playerTurnID everytime it gets updates in db
    gameSessionRef.child('currentPlayer').on("value", (snapshot) => {
      playerTurnID = snapshot.val() || "";
    });

    //Next two refs check for team1 and team2 value to be set and set playerCards to be current player's cards from database
    gameSessionRef.child('team1').on("value", (snapshot) => {
      if (snapshot.val()) {
        team1 = snapshot.val();
        let teamVar = snapshot.val() || {};
        if (teamVar.player1.playerId == playerId) {
          playerCards = teamVar.player1.cards;
        } else if (teamVar.player2.playerId == playerId) {
          playerCards = teamVar.player2.cards;
        }
      }
    });
    gameSessionRef.child('team2').on("value", (snapshot) => {
      if (snapshot.val()) {
        team2 = snapshot.val();
        let teamVar = snapshot.val() || {};
        if (teamVar.player1.playerId == playerId) {
          playerCards = teamVar.player1.cards;
        } else if (teamVar.player2.playerId == playerId) {
          playerCards = teamVar.player2.cards;
        }
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
      image.draggable = 'true';
      userHandDiv.appendChild(image);
    }
   userHandDiv.style.display = "block";
  }

  //Remove card from hand when dragged onto board by player
  //Return that card so we cann add it to board and update db
  function updateHand(id) {
    for (let i = 0; i < Object.keys(playerCards).length; i++) {
      if (playerCards[i] != null) { //Make sure card was not already removed before accessing it 
        if (playerCards[i].suit == id.charAt(0) && playerCards[i].value == id.charAt(1)) { //If suit and value match
          console.log('card matched');
          delete playerCards[i];
        }
      }  
    }
  }

  function percentToPixel(percentVal, dimension) {
    return Math.round(dimension * parseInt(percentVal)/100, 1).toString() + 'px';
  }

  function pixelsToPercent(pixelVal, dimension) {
    return Math.round(100 * parseInt(pixelVal)/dimension, 1).toString() + '%';
  }

  function getNextPlayer() {
    if (playerTurnID == team1.player1.playerId) {
      return team2.player1.playerId;
    } else if (playerTurnID == team1.player2.playerId) {
      return team2.player2.playerId;
    } else if (playerTurnID == team2.player1.playerId) {
      return team1.player2.playerId;
    } else if (playerTurnID == team2.player2.playerId) {
      return team1.player1.playerId;
    }
  }

  function handleDrag(event) {
    event.preventDefault();
    console.log(event);
    if (!event.target.classList.contains('.board-card')) {
        console.log('OVERLAPPING!');  
    } 
  }

  function handleCardEnter(e) {
    console.log('Entered Card');
    console.log(e);
    e.preventDefault();
    let cardId = e.path[0].attributes[2].value; //Get card that was dragged onto
    let cardEl = document.getElementById(cardId);
    cardEl.setAttribute('intersected', 'true');
  }

  function handleCardLeave(e) {
    console.log('Left Card');
    console.log(e);
    e.preventDefault()
    let cardId = e.path[0].attributes[2].value; //Get card that was dragged onto
    let cardEl = document.getElementById(cardId);
    cardEl.setAttribute('intersected', 'false');
  }

  function findIntersected(draggedCard) {
    console.log(draggedCard);
    let draggedCardX = parseFloat(draggedCard.x);
    let draggedCardY = parseFloat(draggedCard.y);
    let returnVal = null;

    document.getElementById('board').childNodes.forEach(card => {
      // console.log(card);
      // console.log('Top: ' + parseInt(card.style.top));
      // console.log('Left: ' + parseInt(card.style.left));
      // console.log('X: ' + parseInt(draggedCard.x));
      // console.log('Y: ' + parseInt(draggedCard.y.replace('%', '')));

      //let cardLeft = parseInt(card.style.left);
      //let cardTop = parseInt(card.style.top);

      //console.log('Check1: ' + parseInt(card.style.left) < parseInt(draggedCard.x.replace('%','')));
      //console.log('Check2: ' +parseInt(card.style.left) + parseInt(card.style.width) > parseInt(draggedCard.x.replace('%','')));
      //console.log( 'Check3: ' + parseInt(card.style.top) < parseInt(draggedCard.y.replace('%','')));
      //console.log( 'Check4: ' + parseInt(card.style.top) + parseInt(card.style.height) > parseInt(draggedCard.y.replace('%','')));
      let squareDim = Math.round(parseInt(card.style.width)/4, 2);
      let squareLeft = Math.round(parseFloat(card.style.left) + 0.5*parseInt(card.style.width) - 0.125*squareDim, 2);
      let squareTop = Math.round(parseFloat(card.style.top) + 0.5*parseInt(card.style.height) - 0.125*squareDim, 2);
      console.log('Square Dim: ', squareDim);
      console.log('squareLeft: ' + squareLeft);
      console.log('squareTop: ' + squareTop);
      // intersectionSquare = {
      //   width: squareDim,
      //   height: squareDim,
      //   left: squareLeft,
      //   top: squareTop
      // };
      let leftCheck = squareLeft > draggedCardX && squareLeft < draggedCardX + (parseFloat(card.style.width) - squareDim);
      let topCheck = squareTop > draggedCardY && squareTop < draggedCardY + (parseFloat(card.style.height) - squareDim);
      console.log('leftcheck: ' + leftCheck);
      console.log('topcheck: ' + topCheck);

      if ( leftCheck && topCheck) {
            returnVal = card.getAttribute('id');
      }
      
      // if (areIntersecting(card, draggedCard)) {
      //   return card
      // }
      // if (parseInt(card.style.left) < parseInt(draggedCard.x.replace('%','')) && parseInt(card.style.left) + parseInt(card.style.width) > parseInt(draggedCard.x.replace('%','')) && parseInt(card.style.top) < parseInt(draggedCard.y.replace('%','')) && 
      // parseInt(card.style.top) + parseInt(card.style.height) > parseInt(draggedCard.y.replace('%',''))) {
      //   return card;
      // }
    });
    return returnVal;
  }

  function areIntersecting(card, draggedCard) {
    let cardLeft = parseInt(card.style.left);
    let cardTop = parseInt(card.style.top);
    let cardWidth = parseInt(card.style.width);
    let cardHeight = parseInt(card.style.height);
    let draggedX = parseInt(draggedCard.x.replace('%', ''));
    let draggedY = parseInt(draggedCard.y.replace('%', ''));

    return cardLeft < draggedX && cardLeft + cardWidth > draggedX && cardTop < draggedY && cardTop + cardHeight > draggedY || //card dragged to bottom right of current
           draggedX < cardLeft && draggedX + cardWidth > cardLeft && draggedY > cardTop && cardTop + cardHeight > draggedY || //card dragged to bottom left of current
           draggedX < cardLeft && draggedX + cardWidth > cardLeft && draggedY < cardTop && draggedY + cardHeight > cardTop || //card dragged to top left of current
           cardLeft < draggedX && cardLeft + cardWidth > draggedX &&  draggedY < cardTop && draggedY + cardHeight > cardTop //card dragged to top right of current
  }
  
  let startingX;
  let startingY;
  let offsetX;
  let offsetY;
  let coordX;
  let coordY;
  let drag;
  let targ;
  let intersectedEl;

  function startDrag(e) {
    console.log(e);
    // determine event object
    if (!e) {
        var e = window.event;
    }

    if(e.preventDefault) e.preventDefault();
  
    // IE uses srcElement, others use target
    targ = e.target ? e.target : e.srcElement;
    console.log(targ);

    if (targ.className != 'card' && targ.className != 'board-card') {return};
    // Save starting values of cards x y coords relative to .user-hand div
    startingX = targ.style.left;
    startingY = targ.style.top;

    // calculate event X, Y coordinates relative to page
    offsetX = e.clientX;
    offsetY = e.clientY;
  
    // assign default values for top and left properties
    if(!targ.style.left) { targ.style.left='0px'};
    if (!targ.style.top) { targ.style.top='0px'};
  
    // calculate integer values for top and left 
    // properties
    coordX = parseInt(targ.style.left);
    coordY = parseInt(targ.style.top);
    console.log('coordX is : ' + coordX);
    console.log('coordY is : ' + coordY);
      
    if (targ.className == 'board-card') { //Convert from percentage to px value
      console.log(targ.style.left);
      console.log(targ.style.top);
      startingX = percentToPixel(targ.style.left, document.getElementById('board').getBoundingClientRect().width);
      startingY = percentToPixel(targ.style.top, document.getElementById('board').getBoundingClientRect().height); 
      coordX = parseInt(percentToPixel(targ.style.left, document.getElementById('board').getBoundingClientRect().width));
      coordY = parseInt(percentToPixel(targ.style.top, document.getElementById('board').getBoundingClientRect().height));
      //console.log('coordX is : ' + coordX);
      //console.log('coordY is : ' + coordY);
    }

      console.log('startX is: ' + startingX);
      console.log('startY is: ' + startingY);

      // if (targ.className == 'board-card') {
      //   startingX = targ.offsetLeft;
      //   startingY = targ.offsetTop;
      // }
    
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
    //console.log(e);
    targ.style.left=coordX+e.clientX-offsetX+'px';
    targ.style.top=coordY+e.clientY-offsetY+'px';

    //Find which card is intersected if any
    let position = document.getElementById('board').getBoundingClientRect();
    let cardId = e.path[0].attributes[2].value;
    let cardEl = document.getElementById(cardId);
    let card = new Card(cardId.charAt(0), cardId.charAt(1));
    let leftOffset = cardEl.offsetLeft;

    card.x = Math.round(100 * leftOffset / position.width, 1).toString() + '%';
    card.y = Math.round((100 * (parseFloat(targ.style.top.replace('px','')) + position.height + 8.5) / position.height), 1).toString()+ '%';

    let intersectedId = findIntersected(card);

    if (intersectedId != null) { //Detect if intersected card was foudn during this mouse mouvement
      intersectedEl = document.getElementById(intersectedId); //Set the style of both the intersected and dragged card to red
      intersectedEl.style.borderColor = "red";
      cardEl.style.border = '5px solid red';
      cardEl.style.borderRadius = '20px';
    } 
    else { //No card detected this mouse movement
      if (intersectedEl != undefined) { //If intersected elements exists delete old border and clear it
        cardEl.style.border = 'none';
        intersectedEl.style.borderColor = 'green';
        intersectedEl = undefined;
      }
    }

    return false;
  }
  
  function stopDrag(e) {
    console.log(e);
    let boardEl = document.getElementById('board');
    let position = boardEl.getBoundingClientRect();

    if (playerTurnID == playerId && targ.className == 'card') {
      let imgPos = targ.getBoundingClientRect();
      //Make sure card was dragged onto the board
      if ((parseFloat(imgPos.left) > parseFloat(position.left) && parseFloat(imgPos.left) < parseFloat(position.left) + (parseFloat(position.width) - parseFloat(imgPos.width))) &&
          (parseFloat(imgPos.top) > parseFloat(position.top) && parseFloat(imgPos.top) < parseFloat(position.top) + (parseFloat(position.height) - imgPos.height))) {
          drag = false;

          //Get card suit and val from html card that was dragged
          let cardId = e.path[0].attributes[2].value;
          let cardEl = document.getElementById(cardId);

          //Update Player Cards
          updateHand(cardId);
          console.log(playerCards);
          let card = new Card(cardId.charAt(0), cardId.charAt(1));
          let leftOffset = cardEl.offsetLeft; // get offset of card from left edge of user hand

          document.querySelector('.user-hand').removeChild(cardEl); //Remove card from hand div and append to board
          cardEl.style.height = '45%';
          cardEl.style.width = '19%';

          cardEl.setAttribute('class', 'board-card');

          console.log('Targ left is: ' + targ.style.left);

          cardEl.style.left = Math.round(100 * leftOffset / position.width, 1).toString() + '%';
          cardEl.style.top = Math.round((100 * (parseFloat(targ.style.top.replace('px','')) + position.height + 8.5) / position.height), 1).toString()+ '%';
          cardEl.style.border = '5px solid green';
          cardEl.style.borderRadius = '20px';

          card.x = cardEl.style.left;
          card.y = cardEl.style.top;
          
          // //Find which card is intersected if any
          // let intersectedId = findIntersected(card);
          // console.log('Interesected is: ' + intersectedId);
          // if (intersectedId != null) {
          //   let intersectedEl = document.getElementById(intersectedId);
          //   intersectedEl.setAttribute('style', 'border: 5px solid red, borderRadius: 20px');
          //   //intersectedEl.setAttribute.borderRadius = '20px';
          // }
          //boardEl.appendChild(cardEl);

          console.log('Left offset board chld is : ' + cardEl.offsetLeft);
          console.log('x is: ' + card.x);
          console.log('y is: ' + card.y);
          board.push(card); //update local board state var

          //Update Database Board with local version
          gameSessionRef.update({ 
            board: board, 
            currentPlayer: getNextPlayer()
        }); 

      } else {
        targ.style.left = startingX;
        targ.style.top = startingY;
        drag = false;
      }
  
    } else { //If card not dragged onto board return to last position
      if (targ.className == 'board-card') {
        targ.style.left = pixelsToPercent(startingX, position.width);
        targ.style.top = pixelsToPercent(startingY, position.height);
        drag = false;
      } else {
        targ.style.left = startingX;
        targ.style.top = startingY;
        drag = false;
      }
      
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







