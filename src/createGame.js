import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import {initRefs, playerId, playerCards} from "./index.js";
import {showCards} from "./index.js";
import Deck from "./deck.js";
import Card from "./card.js";
import { freshDeck } from "./deck.js";
export {gameSessionRef};

var gameId;
let gameSessionRef; 
let playerRef;


export function createGame() {
    gameId = makeid(20);
    gameSessionRef = firebase.database().ref('gameSession/'+gameId);
    playerRef = firebase.database().ref(`players/${playerId}`);
    gameSessionRef.onDisconnect().remove();

    initRefs(gameSessionRef);

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

    //Add player to game session's players
    let newPlayerRef = firebase.database().ref(`gameSession/${gameId}/sessionPlayers`);
    newPlayerRef.child(playerId).set({
      playerId: playerId,
      name: username
    });

    return gameId;
  }


  //Have start game btn update game state launching it for all players
  export function startGame() {
    gameSessionRef.update({
      gameState: 'started'
    });
  }

  //Function creates id for game state, no checks for uniqueness yet
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



  