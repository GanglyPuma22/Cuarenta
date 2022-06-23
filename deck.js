import Card from "./card.js" 

const SUITS = ["♠", "♣", "♥", "♦"]

const VALUES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "J",
  "Q",
  "K"
]

export default class Deck {
	constructor(cards) {
		this.cards = cards;
	}
	
	get numberOfCards() {
		return this.cards.length;
	}
	
  getCards() {
    return this.cards;
  }

  add(suit, value) {
    this.cards.push(new Card(suit, value));
  }

	shuffle() {
		for (let i = this.numberOfCards - 1; i > 0; i--) {
           const newIndex = Math.floor(Math.random() * (i + 1)); 
		   const oldValue = this.cards[newIndex]; 
		   this.cards[newIndex] = this.cards[i];
		   this.cards[i] = oldValue;
		}			
  }

  drawCards(amount, deck) {
    for (let i = 0; i < amount; i++) {
      let card = this.cards.pop();
      console.log(JSON.stringify(card));
      deck.cards.push(card);
    }
  }

  removeTopCard() {
    return this.cards.pop();
  }
  // This function refills the players deck only if he has less than 6 cards, and removes those added cards from the main deck
  /*
   Good practice for functions is to add text that explains what it does, which you added.
   It is also good to put inputs and outputs so that we can quickly see what the function needs.
   Inputs: 
   Outputs: 
  */
  refill(mainDeck,playerDeck){
    // Initiliaze variable just to make things simpler
    let nc = playerDeck.numberOfCards
    
    //Check to see if player's cards are less than 6 and if there are enough cards in the deck to completely refill
    if (nc <6 && nc - mainDeck.numberOfCards >= 0){
      // Adds the cards from the main deck to the players deck then removes it from the main deck
      for (let i = abs(nc-6); i > 0; i--) {
        playerDeck.cards += mainDeck.cards[-1]
        mainDeck.cards.pop();
      }  
    }
    // If there are not enough cards to fill the player's deck, all the cards of the main deck are added to it, and the main deck is deleted
    else if (nc < 6){
      playerDeck.cards += mainDeck.cards
      mainDeck.cards.length = 0 

    }
  }
  
  //This function checks for a limpia, i.e. the displayed cards are 0, and adjusts the points accordingly
  /*
   Inputs: 
   Outputs: 
  */
  checkLimpia(team){
    if (team.checkPoints) {
      if (this.numberOfCards == 0){
            team.points += 2
          } else{
            return false
          }
        }
  }

  



}


export function freshDeck() {
  return SUITS.flatMap(suit => {
    return VALUES.map(value => {
      return new Card(suit, value)
    })
  })
}

// Checks for succesful addition, and adjusts points and team cards accordingly
/*
   Inputs: 
   Outputs: 
*/
function checkAddition(selectedCards,playerCard,playedDeck,team){
  //Calculate the sum of the cards which are selected
  let sumCards = selectedCards.cards.value.reduce(function(a, b){
    return a + b;
    }, 0);
    /*
      It might be worth making a new function here that we should have a generic function updateDeck or maybe two functions 
      removeFromDeck and addtoDeck so that we can use them in any given situation where we alter decks. This works if the inputs to the function are consistant
    */
    //If condition met, team cards are adjusted and cards are removed from the played Deck
    if (sumCards == playerCard.value){
     for (let i = 0; i < selectedCards.numberOfCards; i++){
       playedDeck.splice(playedDeck.indexof(selectedCards[i]),1)
       team.teamCards += selectedCards[i]
     } 
  } //If you have nothing to put in the else statement, you dont have to add it
    //else {
       //return false
     //}

  }  
// This function checks for a Caida, i.e. the value of both cards is the same, and adjust points and team cards accordingly
/*
   Inputs: 
   Outputs: 
*/
function checkCaida(card1,card2,team,playedDeck){
  if (card1.value == card2.value){
    team.teamCards += card1 + card2
    team.points += 2
  } else{
    return false
  }
}

// This function adds cards to the team cards if the cards selected are consecutive and superior  
/*
   Inputs: 
   Outputs: 
*/
function checkSlide(card,playedDeck,selectedCards,team){
  let cardList = card
  //Translate the selected cards so that we can compare their values later on
  for (let i = 0; i < selectedCards.numberOfCards; i++){
    cardList += translate(selectedCards.cards[i])
  }
  //Sort the card list 
  cardList.sort();
  //Check if the card list is consecutive, and if condition met we add these cards to the team cards
  if (checkConsecutive(cardList) == true){
    team.teamCards += selectedCards.cards
  }

}

// Checks to see if the cards are consecutive
/*
   Inputs: 
   Outputs: 
*/
function checkConsecutive(cardList){
  // Check if the difference between two consective cards in the array is different than one
  // The cardList parameter should be sorted beforehand, so if condition is met then the cards are not consecutive
  for (i=0; i< cardList.length; i++){
    if (selectedCards.cards[i+1]-selectedCards[i] != 1){
      return false
    }
  }
  // If first loop has not been triggered, then the cards must be consecutive
  return true
}

// Converts the cards values to integers
/*
   Inputs: 
   Outputs: 
*/
function translate(card){
  if (card.value == "J"){
    return 8
  } else if (card.value =="Q"){
    return 9
  } else if (card.value == "K") {
    return 10
  } else {
    return parseInt(card.value, 10)
  }
}
