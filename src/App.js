import logo from './logo.svg';
import './App.css';
import Deck from "./deck.js";
import { freshDeck } from "./deck.js";
import PlayerTable from './playerTable';
import Card from './card.js';
import DraggableCard, {cardImages, isPlayerTurn} from './cardDragging.js';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { useState, useEffect, useRef} from 'react';
import Draggable from 'react-draggable';
import {createGame, startGame} from './createGame.js';
import {joinGame} from './joinGame.js';
import {playerCards, initRefs} from './index.js';

// import firebase from 'firebase/compat/app';
// import 'firebase/compat/auth';
// import 'firebase/compat/firestore';

// const firebaseConfig = {
//   apiKey: "AIzaSyAnvPUD8NmYUC-fA7ypMvlrfIdAngL0KF0",
//   authDomain: "cuarenta-dfbf1.firebaseapp.com",
//   projectId: "cuarenta-dfbf1",
//   storageBucket: "cuarenta-dfbf1.appspot.com",
//   messagingSenderId: "78708075147",
//   appId: "1:78708075147:web:3bffd7a9a76f0ed27fc28e",
//   measurementId: "G-QE2JKLQ686"
// };
// firebase.initializeApp(firebaseConfig);

function suitToText(suit) {
  if (suit === "♠") {
     return "spades";
  } 
  else if (suit === "♣") {
    return "clubs";
  }
  else if (suit === "♥") {
    return "hearts";
  }
  else if (suit === "♦") {
    return "diamonds";
  } 
  return "";
}

const baseImageUrl = "./cards/";
let gameSessionRef; 



function App() {
  const hostTableRef = useRef(null);
  const userHandRef = useRef(null);
  const [joinGameView, setJoinGameView] = useState(false);
  const [createGameView, setCreateGameView] = useState(false);
  const [gameHostView, setGameHostView] = useState(true);
  const [preJoinView, setPreJoinView] = useState(true);
  const [gameId, setGameId] = useState("");
  const [board, setBoard] = useState({cards : []});
  const [players, setPlayers] = useState({1 :{}, 2:{}, 3:{}, 4:{}});
  const [playerCount, setPlayerCount] = useState(0);
  const [componentArray, setComponentArray] = useState([]);
  const [userHand, setUserHand] = useState({1 :{}, 2:{}, 3:{}, 4:{}, 5 : {}});
  const [currentPlayer, setCurrentPlayer] = useState({name: "", playerId:""});

  function getBorderColor(cardNum, isIntersected, length) {
    let border = 'none';
    //If last card played make border green
    if (cardNum === length-1) {
      border = '5px solid green';
    }
    return border;
  }


  //Creates board elements based on card
  function createBoardElements(cards) {
    let arr = [];
    if (cards) {
      if (cards.length > 0) {
        console.log("INSIDE CARDS");
        for (let i = 0; i < cards.length; i++) {
          console.log(cards[i]);
          console.log(userHandRef);
          arr.push(<img 
          style={{position: 'absolute', top: cards[i].y, left: cards[i].x, height: '45%', width: '19%', border: getBorderColor(i, cards[i].intersected, cards.length)}} 
          // onDragEnter = {() => {
          //   console.log("INTERSECTION BEGINS");
          //   if (isPlayerTurn()) {
          //     cards[i].intersected = true;
          //   }
          // }}
          // onDragOver = {() => {

          // }}
          // onDragLeave = {() => {
          //   console.log("INTERSECTION ENDS");
          //   if (isPlayerTurn()) {
          //     cards[i].intersected = false;
          //   }
          // }}
          className="card" id={cards[i].suit + cards[i].value} draggable="false" 
          src={cardImages(`./${suitToText(cards[i].suit)+"/"+cards[i].value}.PNG`)} 
          alt={cardImages('./default.png')}></img>)
        }
      }
    }
    return arr;
  }

  //Removes ids from keys of players and instead just puts an int
  function processPlayers(players) {
    let tempPlayers = {1:{}, 2:{}, 3:{}, 4:{}};
    let counter = 1;

    Object.keys(players).forEach(key => {
      tempPlayers[counter] = players[key];
      counter++;
    });
    return tempPlayers;
  }

  function updateUserHand() {
    setUserHand({1: playerCards[1], 2: playerCards[2], 3:playerCards[3], 4:playerCards[4], 5:playerCards[5]});
    //console.log(userHand);
  }

  function getImagePath(num) {
    if (Object.keys(playerCards).length !== 0) {
      //Return default image path if not filled yet
      if (playerCards[num].suit && playerCards[num].value) {
        return baseImageUrl+ suitToText(playerCards[num].suit) +"/" ;
        //'./cards/'.concat(suitToText(playerCards[num].suit),"/",playerCards[num].value,".PNG");
      } 
    } 
    return './cards/default.png';
  }

  function findPlayer(id) {
    for (let i =1; i<5; i++) {
      if (players[i].playerId === id) {
        return players[i];
      } 
    }
    return {};
  }

  function createTeams() {
    let team1 = {};
    let team2 = {};

    let deck = new Deck(freshDeck()); //Create game deck
    deck.shuffle(); //Shuffle it
    let deck1 = new Deck([]);
    let deck2 = new Deck([]);
    let deck3 = new Deck([]);
    let deck4 = new Deck([]);
    deck.drawCards(10, deck1);
    deck.drawCards(10, deck2);
    deck.drawCards(10, deck3);
    deck.drawCards(10, deck4);
     

    let table = document.getElementById('player-list-host');

    //Iterate over player table elements
    table.childNodes.forEach((child) => { 
      let currentColor = child.style.backgroundColor;
      if (currentColor === 'red') {
        if (team1.player1) {
          team1.player2 = findPlayer(child.getAttribute('value'));
          team1.player2.cards = deck2.cards;
        } else {
          team1.player1 = findPlayer(child.getAttribute('value'));
          team1.player1.cards = deck1.cards;
        }
      } else if (currentColor === 'blue') {
        if (team2.player1) {
          team2.player2 = findPlayer(child.getAttribute('value'));
          team2.player2.cards = deck4.cards;
        } else {
          team2.player1 = findPlayer(child.getAttribute('value'));
          team2.player1.cards = deck3.cards;
        }
      }
    });

    //Save teams in database, set starting player
    firebase.database().ref('gameSession/'+gameId).update({
      team1: team1,
      team2: team2
    });
  }

  useEffect(() => {
    console.log(userHand);
  }, [userHand]); 

  useEffect(() => {
    console.log("GAME HOST EFFECT RUNNING");
    if (gameId.length === 20) {
        console.log("Creating game session ref listener");
        gameSessionRef = firebase.database().ref('gameSession/'+gameId);

        //Fires whenever a change occurs to playerCount for current game session
        gameSessionRef.child('playerCount').on("value", (snapshot) => { 
          console.log("Player count ref triggered: " + snapshot.val());
          setPlayerCount(snapshot.val());
        }); 

        //Save players
        gameSessionRef.child('sessionPlayers').on("value", (snapshot) => {
          console.log(snapshot.val());
          setPlayers(processPlayers(snapshot.val())); 
        });

        //Save board state
        gameSessionRef.child('board').on("value", (snapshot) => {
          console.log(snapshot.val());
          if (snapshot.val()) {
            setBoard(snapshot.val());
            setComponentArray(createBoardElements(snapshot.val()));
            console.log(componentArray);
          }
        });

        //Save current player on update
        gameSessionRef.child('currentPlayer').on("value", (snapshot) => {
          //setCurrentPlayer(snapshot.val() || "");
          console.log(players);
          if (players) {
            for (let i = 1; i < 5; i++) {
              if (players[i] !== undefined) {
                if (players[i].playerId === snapshot.val()) {
                  setCurrentPlayer(players[i]);
                  console.log(players[i]);
                }
              }
            }
          }
          
        });

        //Detect game start
        gameSessionRef.child('gameState').on("value", (snapshot) => {
          console.log('INSIDE GAME STATE');
          console.log(snapshot.val());
          if (snapshot.val() == 'started') {
            console.log("START GAME");
            //Hide game host 
            setGameHostView(false);
            //Show user cards
            updateUserHand();
          }
        });
      
    }
  }, [gameId]);

  return (
    <div className="App">
    <div id="cuarenta">
    <div id="game-host" style={{display: gameHostView ? 'block' : 'none'}}> 

      <div id = "choose-game-creation-option" style ={{display: joinGameView || createGameView || gameId.length === 20 ? 'none': 'block' }}> 
        <button className="button createGame" name = "create" onClick={() => setCreateGameView(true)}>Create a Game</button>
        <button className="button joinGame" name = "join" onClick={() => setJoinGameView(true)}>Join a Game</button>
        <button className="button testGame" id='test-button' name = "test" style={{display: "none"}}>Test Start</button>
      </div>

      <div id = "join-game" style ={{display: joinGameView ? 'block' : 'none'}}> 
        <div id = 'pre-join' style={{display: preJoinView ? 'block' : 'none'}}>
          <p className="p join-session-name"> Enter your name: </p>
          <input className="input join-session-name" name="join-name" maxLength="30" type="text"/>
          <p className="p join-session-id"> Enter the game session id provided to you by the game host: </p>
          <input className="input join-session-id" name="join-session" maxLength="30" type="text"/>
          <button className="button joinGameSession" name = "join-session" onClick={() => {let id = joinGame(); setGameId(id); setPreJoinView(false)}}> Join Game </button> 
        </div>
        <div id = 'post-join' style={{display: !preJoinView ? 'block' : 'none'}}>
          <p> Successfully joined the game! Waiting on four players.</p> 
          <p id = 'player-count-member'> Player Count: {playerCount}</p>
          <p id = 'waiting-on-game' style={{display: playerCount === 4 ? 'block' : 'none'}}> Waiting on host to start the game</p>
          <PlayerTable host={false} sessionPlayers={players} id="player-list-guest">  </PlayerTable>
        </div>
      </div>

      <div id = "create-game" style ={{display: createGameView ? 'block' : 'none'}}>
        <p className="p created-session-id"> Create Game Session: </p>
        <p className="p create-session-name"> Enter your name: </p>
        <input className="input create-session-name" name="create-name" maxlength="30" type="text"/>
        <button className="button createGameSession" name="create-session" onClick={() => {console.log('creating'); let id = createGame(); setCreateGameView(false); setGameId(id)}}> Create Game </button> 
      </div>

      <div id = "create-game-id-created" style={{display: gameId.length !== 20 || joinGameView ? 'none' : 'block'}}>
        <p id = "game-id-host"> Game Session ID is: {gameId} </p>
        <p> Share your game session ID to three other players. Once all four are connected the game will start. </p>
        <p id = "player-count-host"> Player Count: {playerCount} 
        <h3 style = {{color: "red"}}> Team 1</h3>
        <h3 style = {{color: "blue"}}> Team 2</h3>
        </p>
        <PlayerTable ref={hostTableRef} host={true} sessionPlayers={players} id="player-list-host">  </PlayerTable>
        <h2 id = "players-host"> Players: </h2>
        
        <button id="start-game-btn" style={{display: playerCount === 4 ? 'block' : 'none'}}onClick={() => {createTeams(); startGame();}}> Start Game </button>
      </div>

    </div>
    
    <div id="board" onDragOver={() => console.log("DRAGGING")} onDrop= {() => console.log("DROPPED")} onDragEnter = {() => { console.log("CARD IS ON BOARD")}} onDragLeave = {() => { console.log("CARD IS NOT A PART OF BOARD")}} boardCards={board.cards}> 
      {componentArray}
    </div>

    <DraggableCard gameId={gameId} id="card-slot1" num="1" card={userHand[1]}> </DraggableCard>
    <DraggableCard gameId={gameId} id="card-slot2" num="2" card={userHand[2]}> </DraggableCard>
    <DraggableCard gameId={gameId} id="card-slot3" num="3" card={userHand[3]}> </DraggableCard>
    <DraggableCard gameId={gameId} id="card-slot4" num="4" card={userHand[4]}> </DraggableCard>
    <DraggableCard gameId={gameId} id="card-slot5" num="5" card={userHand[5]}> </DraggableCard>_

    <div id = "game-details" style={{display: Object.keys(userHand[1]).length !== 0 ? 'block' : 'none'}}> 
      Current Player Turn: {currentPlayer.name}
    </div>

    {/* <div className="user-hand" ref={userHandRef} style={{display: Object.keys(userHand[1]).length !== 0 ? 'block' : 'none'}}> 
      <DraggableCard gameId={gameId} id="card-slot1" num="1" card={userHand[1]}> </DraggableCard>
      <DraggableCard gameId={gameId} id="card-slot2" num="2" card={userHand[2]}> </DraggableCard>
      <DraggableCard gameId={gameId} id="card-slot3" num="3" card={userHand[3]}> </DraggableCard>
      <DraggableCard gameId={gameId} id="card-slot4" num="4" card={userHand[4]}> </DraggableCard>
      <DraggableCard gameId={gameId} id="card-slot5" num="5" card={userHand[5]}> </DraggableCard>_
    </div>  */}
    
  </div>

  

  </div>
  );
}

export default App;