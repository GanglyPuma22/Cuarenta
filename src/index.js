import React, {useState} from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import DraggableCard from './cardDragging.js';
import Card from "./card.js";
import Deck from "./deck.js"
import { freshDeck } from "./deck.js";
import { startDrag } from "./cardDragging.js";
import { stopDrag } from "./cardDragging.js";
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAnvPUD8NmYUC-fA7ypMvlrfIdAngL0KF0",
  authDomain: "cuarenta-dfbf1.firebaseapp.com",
  projectId: "cuarenta-dfbf1",
  storageBucket: "cuarenta-dfbf1.appspot.com",
  messagingSenderId: "78708075147",
  appId: "1:78708075147:web:3bffd7a9a76f0ed27fc28e",
  measurementId: "G-QE2JKLQ686"
};
firebase.initializeApp(firebaseConfig);

const gameSessionBtn = document.querySelector("button[name='create-session'");
const joinSessionBtn = document.querySelector("button[name='join-session'");
const joinSessionInp = document.querySelector("input[name='join-session'");
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

//Database Var
let playerTurnID;
//let gameSessionRef;
let team1 = {};
let team2 = {};
let playerId;
let playerCount;
let playerRef;
let players;

//Storage Vars
let playerCards = {};
let board = []; //Initialize board array that will store databse board info

//Boolean set to true when test  button pressed
let inTestMode = false;


export {team1,team2,players, board, playerCards, playerTurnID, playerId, playerCount};

//After login this function triggers
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log('Logged in');
    //You're logged in!
    playerId = user.uid;
    //document.querySelector('.user-hand').setAttribute('playerId',playerId); //Save this playerId inside hand for quick access in outside files
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

//Function initiates watching variables changes for both host and members
export function initRefs(gameSessionRef) {
  console.log(gameSessionRef);
  gameSessionRef.child('board').on("value", (snapshot) => {
     board = snapshot.val() || [];
  });
  //Update local board var when board value changes
  // gameSessionRef.child('board').on("value", (snapshot) => {
  //   board = snapshot.val() || [];
  //   //Draw cards for all players
  //   //if (playerId != playerTurnID) {
  //   let boardEl = document.getElementById('board');
  //   //Remove html children on board
  //   boardEl.childNodes.forEach((card) => {
  //     boardEl.removeChild(card);
  //   });
    
  //   //Redraw them
  //   for (let i = 0; i < board.length; i++) {
  //     let tempCard = new Card(board[i].suit, board[i].value);
  //     let imgEl = tempCard.createHTML();
  //     imgEl.style.left = board[i].x;
  //     imgEl.style.top = board[i].y;
  //     imgEl.style.height = '45%';
  //     imgEl.style.width = '19%';
  //     imgEl.setAttribute('class', 'board-card');
  //     if (i == board.length - 1) { //Last card in board array is last card played
  //       imgEl.style.border = '5px solid green';
  //       imgEl.style.borderRadius = '20px';
  //     }
  //     imgEl.setAttribute('intersected', 'false');
  //     // imgEl.ondragenter = handleCardEnter;
  //     // imgEl.ondragleave = handleCardLeave;
  //     // imgEl.ondragover = handleDrag;
  //     boardEl.appendChild(imgEl);
      
  //     //imgEl.position = 'absolute';
  //   }
  //   //}
  // });

  //Updates local var playerTurnID everytime it gets updates in db
  gameSessionRef.child('currentPlayer').on("value", (snapshot) => {
    playerTurnID = snapshot.val().playerId || "";
  });

  //Update local var players everytme it gets updated in db
  gameSessionRef.child("sessionPlayers").on("value", (snapshot) => {
    players = snapshot.val() || {};
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
// function updateGameState() {
  // gameSessionRef.update({ 
  //   board: board, 
  //   currentPlayer: getNextPlayer()
  // }); 
// }
export function showCards(playerdeck) {
  const userHandDiv = document.querySelector(".user-hand");
  const cardLocation = document.getElementById("card-location");
  //let counter = 0;
  for (let i = 0; i < 5; i++) {
    let card = new Card(playerdeck[i].suit, playerdeck[i].value);
    let image = card.createHTML();
    //image.onmousedown = startDrag;
    //image.onmouseup = stopDrag;
    //image.draggable = 'true';
    
    let cardEl = document.getElementById('card-slot' + i.toString());
    console.log(cardEl);
    
    //cardEl.setAttribute('suit', card.suit);
    //cardEl.setAttribute('value', card.value);
  }
  userHandDiv.style.display = "block";
}

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








// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
