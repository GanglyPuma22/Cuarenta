export default class Card {
	constructor(suit, value) {
		this.suit = suit;
    this.value = value;
    this.clickedOn = false;
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
    img.src = "cards/".concat(this.suitToText(),"/",this.value,".PNG");
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
