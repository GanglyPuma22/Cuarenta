export default class Card {
	constructor(suit, value) {
		this.suit = suit;
        this.value = value;
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

  createHTML() {
    var img = document.createElement("img");
    var suitText = this.suitToText()
    img.src = "cards/".concat(suitText,"/",this.value,".PNG");
    return img;
  }

}