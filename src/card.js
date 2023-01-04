export default class Card {
	constructor(suit, value) {
		this.suit = suit;
    this.value = value;
    this.clickedOn = false;
    this.intersected = false;
  }
  
  get color() {
    return this.suit === "♣" || this.suit === "♠" ? "black" : "red"
  }

  suitToText() {
    if (this.suit === "♠") {
       return "spades";
    } 
    else if (this.suit === "♣") {
      return "clubs";
    }
    else if (this.suit === "♥") {
      return "hearts";
    }
    else {
      return "diamonds";
    }
  }
   
  /* Function creates an HTML image element for a given card */
  createHTML() {
    var img = document.createElement("img");
   // var context = img.getCon
    
    //let image = require('./cards/'.concat(this.suitToText(),"/",this.value,".PNG"));
    let image= null;
    img.src = image;
    img.classList.add("card");
    img.setAttribute('id', this.suit + this.value);
    return img;
  }

  getHTML() {
    const cardDiv = document.createElement("div")
    cardDiv.innerText = this.suit
    cardDiv.classList.add("card", this.color)
    cardDiv.dataset.value = `${this.value} ${this.suit}`
    return cardDiv
  }
}
