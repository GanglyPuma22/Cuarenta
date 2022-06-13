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
    img.dataset.value = `${this.value} ${this.suit}`;

    // img.addEventListener("mousedown", (e) => {
    //   console.log("mouse location:", e.clientX, e.clientY);
    //   this.clickedOn = true;
    // });

    // img.addEventListener("mouseup", (e) => {
    //   this.clickedOn = false;
    // });

    // //img.onmousemove = function(e){console.log("mouse location:", e.clientX, e.clientY)};
    // img.addEventListener('mousemove', e => {
      
    //   if (this.clickedOn) {
    //     console.log("mouse location:", e.clientX, e.clientY);
    //     img.style.left = e.clientX + "px";
    //     img.style.top = e.clientY + "px";
    //   }
    // });
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
