  import { playerTurnID, playerId, playerCards,board, team1, team2} from "./index.js";
  import firebase from 'firebase/compat/app';
  import 'firebase/compat/database';
  import Card from "./card.js";
  import Draggable from 'react-draggable';
  //import defaultImage from '../public/cards/default.png';
  import {useEffect} from 'react';
  import React, {useState, useRef} from 'react';

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
    } else {
      return "default";
    }
  }
  export const cardImages = require.context('../public/cards', true);

  export function isPlayerTurn() {
      return playerId === playerTurnID;
  }

  //Gets the team of current player
  function findTeam() {
    switch(playerId) {
      case team1.player1.playerId: return 1;
      case team1.player2.playerId: return 1;
      default: return 2;
    }
  }
  //Determines if card img html is inside board div element
  function cardOnBoard(e) {
    let boardDim = document.getElementById("board").getBoundingClientRect();

    return boardDim.x + boardDim.width > e.clientX && boardDim.x < e.clientX &&
    boardDim.y < e.clientY && boardDim.y + boardDim.height > e.clientY;
  }

  //Determines if two elements overlap visually
  function elementsOverlap(el1, el2) {
    const domRect1 = el1.getBoundingClientRect();
    const domRect2 = el2.getBoundingClientRect();
  
    return !(
      domRect1.top > domRect2.bottom ||
      domRect1.right < domRect2.left ||
      domRect1.bottom < domRect2.top ||
      domRect1.left > domRect2.right
    );
  }

  //Finds and returns the board element which current dragged card intersects
  //Returns null if no intersections
  function findIntersected(e, boardEl) {
    if (boardEl.children.length > 0) {
      let child;
      for (child of boardEl.children) {
        if (elementsOverlap(child, e.target)) {
          return child;
        }
      }
      return null;
    }
  }

  //Stores currently intersected card on board
  var intersectedCard = null;

  class DraggableCard extends React.Component {
    constructor(props) {
      super(props);
    }
    
    state = {
      intersecting: false,
      clientPosition: {
         x: 0, y: 0
      },
      controlledPosition: {
        x: 0, y: 0
      }
    };


    updateLastPosition = (e, position) => {
      const {x, y} = position;
      //Check if this x and y happens to overlap another card
      this.setState({intersecting: false, controlledPosition: {x, y}, clientPosition: {x: e.clientX, y: e.clientY}});
      console.log(e);
      //e.path[0].style.border = 'none';
    };


    onControlledDrag = (e, position) => {
      //Remove border from intersectedCard when fdragged card moves away
      if (!this.intersecting && intersectedCard) {
        intersectedCard.style.border = 'none';
      }

      //ONLY UPDATE POSITION IF CARD ISNT ALREADY ON BOARD
      const {x, y} = position;
      //Check if this x and y happens to overlap another card
      this.setState({controlledPosition: {x, y}, clientPosition: {x: e.clientX, y: e.clientY}});

      //If current players turn update intersected card border color to show what move they are making
      if (isPlayerTurn()) {
        intersectedCard = findIntersected(e, document.getElementById("board"));
        //If card intersection detected update its border color and state of dragged card
        if (intersectedCard) {
          this.setState({intersecting: true});
          intersectedCard.style.border = '5px solid red';
        } else { //Otherwise revert to old state
          this.setState({intersecting: false});
        }

      }

    };
  
    onControlledDragStop = (e, position) => {
      if (isPlayerTurn()) {
        this.updateLastPosition(e, position); //Update last position
        if (cardOnBoard(e)) {
          let cardId = e.target.attributes.id.value;
          let card = new Card(cardId.charAt(0), cardId.charAt(1));
          let boardDim = document.getElementById('board').getBoundingClientRect();
          card.x = pixelsToPercent(e.clientX - boardDim.x - e.offsetX, boardDim.width);  //Subtract distance from left corner to user hand left corner
          card.y = pixelsToPercent(e.clientY - boardDim.y - e.offsetY, boardDim.height); //- e.path[2].children[1].offsetTop; //Subtract distance from board top

          //Check play and update board with results
          let result = checkPlay(card);
          console.log(result);
          //Add card to board before checking how it is updated
          board.push(card);
          updateBoard(result.cardsToRemove);
          console.log(board);

          //Update database with new board state and next player
          firebase.database().ref('gameSession/'+ this.props.gameId).update({ 
            currentPlayer: getNextPlayer(),
            board: {
                    boardCards: board, //cardsToRemove array of cards to take out of board var
                    keidaCard: result.cardsToRemove.length == 0 ? card : {}
                   },
            //Check if first round is over
            gameState: team1.cardsCollected + team2.cardsCollected + result.cardsCollected + board.length == 20 ? "round1over" : ""
          }); 

          //Update current player teams' points and cards collected
          firebase.database().ref('gameSession/'+ this.props.gameId + '/team' + findTeam()).update({ 
            points: findTeam() == 1 ? team1.points + result.points : team2.points + result.points, 
            cardsCollected: findTeam() == 1 ? team1.cardsCollected + result.cardsCollected : team2.cardsCollected + result.cardsCollected
          }); 

          //Delete played card from DOM
          e.target.remove();

        } else { //Return to start if not placed on board
          this.updateLastPosition(e, {x:0, y:0});
        }
      } else {
        //Return to start if not players turn
        this.updateLastPosition(e, {x:0, y:0});
      }
    };
  
    render() {
      const {intersecting, controlledPosition, clientPosition} = this.state;

      if (Object.keys(this.props.card).length === 0) {
        return null;
      }

      return (<Draggable position={controlledPosition} onDrag={this.onControlledDrag} onStop={this.onControlledDragStop}>
        <img className="card" id={this.props.card.suit + this.props.card.value} draggable="false" src={cardImages(`./${suitToText(this.props.card.suit)+"/"+this.props.card.value}.PNG`)} alt={cardImages('./default.png')}></img>
        </Draggable>); 
    }
  }
  

  //Function updates board by removing the cards in cardsToRemove array provided by checkplay function
  function updateBoard(cardsToRemove) {
    if (cardsToRemove.length != 0) {
      cardsToRemove.forEach(function (card) {
        //If board contains a card to remove call splice on it to remove that element
        for (let i = 0; i < board.length; i++) {
          if (board[i].suit === card.suit && board[i].value === card.value) {
            board.splice(i, 1);
          }
        }
      });
    }
  }

  //Function converts cards' values to numeric
  function mapCardVal(cardVal) {
    switch (cardVal) {
      case "A": 
        return 1;
      case "J": 
        return 8;
      case "Q": 
        return 9;
      case "K": 
        return 10;
      default:
        return parseInt(cardVal);
    }
  }

  /* Function checks if last card intersection was a valid play
  * board is current board state, card is object version of played card
  * Returns cards to remove from board
  */
  function checkPlay(card) {

    let res = {
      cardsCollected: 0,
      points: 0,
      cardsToRemove: [],
      board: board
    };

    //If card was intersected check all rules resulting of that
    if(intersectedCard) {
      //Check if two cards intersected have same value
      if (intersectedCard.id[1] == card.value) {
        res.cardsCollected = 2;
        
        let lastPlayedCard = board[board.length - 1];

        res.cardsToRemove.push( new Card(intersectedCard.id[0], intersectedCard.id[1]));//Remove intersected card
        res.cardsToRemove.push(card); //Remove played card

        //Check if card was also last played by opponent meaning Keida
        if (lastPlayedCard.suit + lastPlayedCard.value === intersectedCard.id) {
          //Add two points and two cards to count
          res.points = 2;
          console.log("KEIDA");
        }

        let consecVal = mapCardVal(card.value);

        //Check if there exists consecutive cards and highlight them red
        while (board.some(card => mapCardVal(card.value) === consecVal + 1)) {
          //Find index of consec card
          let consecCard = board[board.findIndex(card => mapCardVal(card.value) === consecVal + 1)];
          //Remove consec cards from board
          res.cardsToRemove.push(consecCard);
          document.getElementById(consecCard.suit + consecCard.value).style.border = "5px solid red";
          consecVal++;
          res.cardsCollected = res.cardsCollected + 1;
        }
      } else { //Check for addtion rule
        //Iterate over all pairs of cards on board
        for (let pair of getPairs(card)) {
          //If intersected card is part of a pair select that pair as chosen
          if (pair.card1.suit + pair.card1.value === intersectedCard.id || pair.card2.suit + pair.card2.value === intersectedCard.id) {
            document.getElementById(pair.card1.suit + pair.card1.value).style.border = "5px solid red";
            document.getElementById(pair.card2.suit + pair.card2.value).style.border = "5px solid red";
            //Remove played card
            res.cardsToRemove.push(card); 
            //Remove pair cards
            res.cardsToRemove.push(pair.card1);
            res.cardsToRemove.push(pair.card2);
            //Update points
            res.cardsCollected = res.cardsCollected + 3;
          }
          
        }
      }

      //After updating board check for limpia, when board is cleared as a result of play
      if (res.cardsToRemove.length == board.length + 1) {
        res.points = 2; //Add points
        console.log("LIMPIA");
      }
    } 

    return res;
  }

  export default DraggableCard;

  //Function returns an array containing all pairs of elements in input array
  function getAllPairs(arr) {
    var pairs = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        pairs.push([arr[i], arr[j]]);
      }
    }
    return pairs;
  }
  
  //Function returns all pairs of card on board that sum to played card
  function getPairs(playedCard) {
    let pairs = getAllPairs(board);
    let playedCardVal = mapCardVal(playedCard.value);

    let output = [];

    if (playedCardVal != 8 && playedCardVal != 9 && playedCardVal != 10 && playedCardVal != 1) {
      for (let i = 0; i < pairs.length; i++) {
        //Check if the cards in a a pair sum to playedCard's value
        if (mapCardVal(pairs[i][1].value) + mapCardVal(pairs[i][0].value) == playedCardVal) {
          //Add output to possible pairs that sum to playedCard's value
          output.push({
            card1: pairs[i][0],
            card2: pairs[i][1]
          });
        }
      }
    }
    return output;
  }

  function percentToPixel(percentVal, dimension) {
    return Math.round(dimension * parseInt(percentVal)/100, 1).toString() + 'px';
  }

  //Function normalizes a pixel distance to a percentage to position cards on board in same spot on all player's screens
  function pixelsToPercent(pixelVal, dimension) {
    return Math.round(100 * parseInt(pixelVal)/dimension, 1).toString() + '%';
  }

  //Function returns next player in sequence defined by game rules
  export function getNextPlayer() {
    let nextPlayer = {};

    if (playerTurnID == team1.player1.playerId) {
      nextPlayer.name = team2.player1.name;
      nextPlayer.playerId = team2.player1.playerId;
    } else if (playerTurnID == team1.player2.playerId) {
      nextPlayer.name = team2.player2.name;
      nextPlayer.playerId = team2.player2.playerId;
    } else if (playerTurnID == team2.player1.playerId) {
      nextPlayer.name = team1.player2.name;
      nextPlayer.playerId = team1.player2.playerId;
    } else if (playerTurnID == team2.player2.playerId) {
      nextPlayer.name = team1.player1.name;
      nextPlayer.playerId = team1.player1.playerId;
    }

    return nextPlayer;
  }

 