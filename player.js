import Card from "./card";

export default class Players{
    constructor(){
        this.hand = [];
        this.cardCount = 0;
    }

    getHand() {
        return this.hand;
    }
    //Adds new card to player hand and increases card count
    drawCard(suit, value) {
        this.cardCount ++;
        this.hand.push(new Card(suit, value));
    }

}
