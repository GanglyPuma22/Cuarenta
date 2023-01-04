import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import {initRefs, playerId, playerCards} from "./index.js";
import {showCards} from "./index.js";
import Deck from "./deck.js";
import Card from "./card.js";
import { startDrag } from "./cardDragging.js";
import { stopDrag } from "./cardDragging.js";

let players ={};

export function joinGame() {
    const joinSessionInp = document.querySelector("input[name='join-session'");
    let gameID ="";
    //TODO Improve how we determine the sessionID is valid, right now it just makes sure its the right length for 1
    if (joinSessionInp.value.length == 20) {
      //let sessionRef = firebase.database().ref('gameSession/'+joinSessionInp.value);
      gameID = joinSessionInp.value
      console.log(gameID);
      //Save game id in html page
      document.getElementById('game-host').setAttribute('gameId', gameID);
      let gameSessionRef = firebase.database().ref('gameSession/'+ gameID);
      let gameSessionJoinRef = firebase.database().ref('gameSession/'+ gameID +'/sessionPlayers');
      let playerRef = firebase.database().ref(`players/${playerId}`);
      let playerCountRef = firebase.database().ref('gameSession/'+ gameID +'/playerCount');

      initRefs(gameSessionRef);

      let username = document.querySelector("input[name='join-name'").value;
      playerRef.update({
        name: username
      });

      //Updates local variable players with data every time players gets updated
      gameSessionJoinRef.on("value", (snapshot) => { //Fires whenever a change occurs
        players = snapshot.val() || {};
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

    return gameID;
  }
