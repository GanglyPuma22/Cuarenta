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
  console.log(cardImages);
  //const defaultImage = require.context('../public/cards/default.png', true);

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
          //if (intersectedCard) {
            //Check if intersection was a productive play
            //checkPlay(board, card);
            //If not valid play just draw it as normal moving it away from card
          //}

          //Check play and update board with results
          let result = checkPlay(card);
          console.log(result);
          //Add card to board before checking how it is updated
          board.push(card);
          updateBoard(result.cardsToRemove);
          console.log(board);

          //Update keida card seperately to give border color time to update
          // firebase.database().ref('gameSession/'+ this.props.gameId).update({ 
          //   keidaCard: !cardsRemoved ? card : {},
          // }); 

          //TODO
          //Check on limpia post keida

          //Fix keida not updating board correctly
          //BIG CHANGE: 
          //It would probably be good to breakout the updating board functionality and checkplay functionality 
          //This file is just supposed to take care of dragging
          //UPDATE BOARD FUNCTION PROBLEM because cards to remove returns correctly
          //Figure out how to deal with sums of cards
          //Add banner above saying your name

          //board.push(card);

          firebase.database().ref('gameSession/'+ this.props.gameId).update({ 
            currentPlayer: getNextPlayer(),
            board: {
                    boardCards: board, //cardsToRemove array of cards to take out of board var
                    keidaCard: result.cardsToRemove.length == 0 ? card : {}
                   }
          }); 

          //Update current player teams' points and cards collected
          let teamNum = findTeam();
          if (teamNum == 1) {
            firebase.database().ref('gameSession/'+ this.props.gameId + '/team1').update({ 
              points: team1.points + result.points, 
              cardsCollected: team1.cardsCollected + result.cardsCollected
            }); 
          } else {
            firebase.database().ref('gameSession/'+ this.props.gameId + '/team2').update({ 
              points: team2.points + result.points, 
              cardsCollected: team2.cardsCollected + result.cardsCollected
            }); 
          }
          
          //Delete played card
          //e.target.style.display = 'none';
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
  

  //Checks if board contains card with consecutive vlaue to input
  // function containsConsecutive(board, cardVal) {
  //   if (board.some(card => card.value === parseInt(cardVal) + 1)) {
  //     /* vendors contains the element we're looking for */
  //     const i = vendors.findIndex(e => e.Name === 'Magenic');
  //   }

  //   for(let card of board) {
  //     if (mapCardVal(card.value) ==  cardVal + 1) {
  //       document.getElementById(card.suit + card.value).style.border = "5px solid red";
  //       return card;
  //     }
  //   }
  // }


  //Function updates board by removing the cards in cardsToRemove array provided by checkplay function
  //If cardsToRemove array is empty, simply push playedCard onto the board as the play
  //Return if cards were removed or not

  // function updateBoard(cardsToRemove, playedCard) {
  //   if (cardsToRemove.length === 0) {
  //     board.push(playedCard);
  //   } else {
  //   }
  // }
  function updateBoard(cardsToRemove) {
    //var tempBoard = board;
    console.log(board);

    if (cardsToRemove.length != 0) {
      cardsToRemove.forEach(function (card) {
        //If board contains a card to remove splice board array at that index
        board.forEach(function(boardCard) {
          if (boardCard.suit === card.suit && boardCard.value === card.value) {
            console.log(boardCard);
            removeCard(boardCard);
            //board.splice(board.findIndex(boardCard => boardCard.suit + boardCard.value === card.suit + card.value), 1)
          }
        });
        // console.log(board[board.findIndex(boardCard => boardCard.suit + boardCard.value === card.suit + card.value)]);
        // board.splice(board.findIndex(boardCard => boardCard.suit + boardCard.value === card.suit + card.value), 1)
        //console.log(board);
      });
      // for (let card of cardsToRemove) {
        
      // }
    }
  }

  // function updateBoard(cardsToRemove) {
  //   var tempBoard = board;
  //   console.log(tempBoard);

  //   if (cardsToRemove.length != 0) {
  //     cardsToRemove.forEach(function (card) {
  //       //If board contains a card to remove splice board array at that index
  //       tempBoard.forEach(function(boardCard) {
  //         if (boardCard.suit === card.suit && boardCard.value === card.value) {
  //           console.log(boardCard);
  //           tempBoard = removeCard(tempBoard, boardCard);
  //         }
  //       });
  //       // console.log(board[board.findIndex(boardCard => boardCard.suit + boardCard.value === card.suit + card.value)]);
  //       // board.splice(board.findIndex(boardCard => boardCard.suit + boardCard.value === card.suit + card.value), 1)
  //       //console.log(board);
  //     });
  //     // for (let card of cardsToRemove) {
        
  //     // }
  //   }
  //   console.log(tempBoard);
  //   return tempBoard;
  // }

  function removeCard(card) {
    for (let i = 0; i < board.length; i++) {
        if (board[i].suit === card.suit && board[i].value === card.value) {
          board.splice(i, 1);
        }
    }
    console.log(board);
  }

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

  //Function checks if last card intersection was a valid play
  //board is current board state, card is object version of played card
  //Returns cards to remove from board
  function checkPlay(card) {
    console.log(board);
    let res = {
      cardsCollected: 0,
      points: 0,
      cardsToRemove: [],
      board: board
    };

    //Keep track of which cards to remove from board
    let cardsToRemove = [];

    //If card was intersected check all rules resulting of that
    if(intersectedCard) {
      console.log(intersectedCard.id[1]);
      //Check if two cards intersected have same value
      if (intersectedCard.id[1] == card.value) {
        let lastPlayedCard = board[board.length - 1];

        res.cardsToRemove.push( new Card(intersectedCard.id[0], intersectedCard.id[1]));//Remove intersected card
        res.cardsToRemove.push(card); //Remove played card

        //Check if card was also last played by opponent meaning Keida
        if (lastPlayedCard.suit + lastPlayedCard.value === intersectedCard.id) {
          //Add two points and two cards to count
          res.points = 2;
          res.cardsCollected = 2;
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
      }
      
      //After updating board check for limpia 
      if (cardsToRemove.length == board.length) {
        res.points = 2;
        console.log("LIMPIA");
      }
    } else { 
      //Below concept is wrong approach. Check sum should be done on top of what is already done not instead of intersected card


      //No card intersection check for sums, otherwise
      //Check SUM, highlight cards red
      //Get all pairs that sum to played card, only relevant to number cards
      for (let pair of getPairs(card)) {
        document.getElementById(pair.card1.suit + pair.card1.value).style.border = "5px solid red";
        document.getElementById(pair.card2.suit + pair.card2.value).style.border = "5px solid red";
      }
    }

    return res;
  }

  export default DraggableCard;

  function getAllPairs(arr) {
    var pairs = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        pairs.push([arr[i], arr[j]]);
      }
    }
    return pairs;
  }
 
  function getPairs(playedCard) {
    let pairs = getAllPairs(board);
    let playedCardVal = mapCardVal(playedCard.value);

    let output = [];

    if (playedCardVal != 8 && playedCardVal != 9 && playedCardVal != 10 && playedCardVal != 1) {
      for (let i = 0; i < pairs.length; i++) {
        if (mapCardVal(pairs[i][1].value) + mapCardVal(pairs[i][0].value) == playedCardVal) {
          console.log("PAIR FOUND: ",pairs[i]); 
          output.push({
            card1: pairs[i][0],
            card2: pairs[i][1]
          });
        }
      }

      // for (let boardCard of board) {
      //   let boardCardVal = mapCardVal(boardCard);
      //   if (boardCardVal != 8 && boardCardVal != 9 && boardCardVal != 10) {
      //     if (board.some(card => boardCardVal + mapCardVal(card.value) === playedCardVal) &&
      //         !pairs.some(pair => pair.card1.suit === boardCard.suit && pair.card1.value === boardCard.value)) {
      //       pairs.push({
      //         card1: board[board.findIndex(card => boardCardVal + mapCardVal(card.value) === playedCardVal)],
      //         card2: boardCard
      //       });
            
      //     }
      //   }
      // }
    }
    console.log(output);
    return output;
  }

  function percentToPixel(percentVal, dimension) {
    return Math.round(dimension * parseInt(percentVal)/100, 1).toString() + 'px';
  }

  function pixelsToPercent(pixelVal, dimension) {
    return Math.round(100 * parseInt(pixelVal)/dimension, 1).toString() + '%';
  }

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

 