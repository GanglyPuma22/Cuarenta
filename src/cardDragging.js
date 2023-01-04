  import { playerTurnID, playerId, playerCards, board, team1, team2} from "./index.js";
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
  console.log(cardImages);
  //const defaultImage = require.context('../public/cards/default.png', true);

  export function isPlayerTurn() {
      return playerId === playerTurnID;
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
          //Update board variable and visuals
          console.log(e);
          console.log(board);

          let cardId = e.target.attributes.id.value;
          let card = new Card(cardId.charAt(0), cardId.charAt(1));
          //let boardEl = e.target.offsetParent.offsetParent.children[1];
          let boardDim = document.getElementById('board').getBoundingClientRect();
          card.x = position.x;
          card.y = position.y;
          card.x = pixelsToPercent(e.clientX - boardDim.x - e.offsetX, boardDim.width);  //Subtract distance from left corner to user hand left corner
          //console.log(e.clientY - e.offsetY - (userHandEl.offsetTop - boardEl.offsetTop));
          card.y = pixelsToPercent(e.clientY - boardDim.y - e.offsetY, boardDim.height); //- e.path[2].children[1].offsetTop; //Subtract distance from board top
          //let board = this.props.boardCards;

          //Check if card was intersected
          if (intersectedCard) {
            //Check if intersection was a productive play
            checkPlay(board, card);
            //If not valid play just draw it as normal moving it away from card
          }

          //TODO
          //Update Board --> Push or remove as needed figure that out
          //updateBoard(cardList);

          //Figure out how to count points

          //Update left side current player and points information etc...

          board.push(card);
          console.log(board);

          firebase.database().ref('gameSession/'+ this.props.gameId).update({ 
            board: board, 
            currentPlayer: getNextPlayer()
          }); 

          //Hide played card
          e.target.style.display = 'none';


        } else { //Return to start if not placed on board
          this.updateLastPosition(e, {x:0, y:0});
        }
      } else {
        //Return to start if not players turn
        this.updateLastPosition(e, {x:0, y:0});
      }
    };
  
    render() {
      const dragHandlers = {onStart: this.onStart, onStop: this.onStop};
      const {intersecting, controlledPosition, clientPosition} = this.state;

      if (Object.keys(this.props.card).length === 0) {
        return null;
      }

      return (<Draggable position={controlledPosition} onDrag={this.onControlledDrag} onStop={this.onControlledDragStop}>
        <img className="card" id={this.props.card.suit + this.props.card.value} draggable="false" src={cardImages(`./${suitToText(this.props.card.suit)+"/"+this.props.card.value}.PNG`)} alt={cardImages('./default.png')}></img>
        </Draggable>); 
    }
  }

  function checkPlay(board, card) {
    let cardsToRemove = [];
    console.log(intersectedCard);
    //Check if two cards intersected have same value
    if (intersectedCard.id[1] == card.value) {
      let lastPlayedCard = board[board.length - 1];
      //Check if card was also last played by opponent meaning Keida
      if (lastPlayedCard.suit + lastPlayedCard.value === intersectedCard.id) {
        console.log("KEIDA");
        cardsToRemove.push(lastPlayedCard);
        cardsToRemove.push(card)
        return cardsToRemove;
      }
    }
    

    //After updating board check for limpia 
  }

  export default DraggableCard;

  function percentToPixel(percentVal, dimension) {
    return Math.round(dimension * parseInt(percentVal)/100, 1).toString() + 'px';
  }

  function pixelsToPercent(pixelVal, dimension) {
    return Math.round(100 * parseInt(pixelVal)/dimension, 1).toString() + '%';
  }

  export function getNextPlayer() {
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

 