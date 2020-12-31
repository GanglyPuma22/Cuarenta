export default class Team {
    constructor(players,points,teamCards){
        this.players = players;
        this.points = 0;
        this.teamCards = [];
    }

    addPoints(gained){
        this.points += gained
    }
    
    // Once round is done, checks if the number of cards the team has won is over 19, and adjusts points accordingly
    checkOver(){
        let nc = this.teamCards.numberOfCards
        if (nc > 19 && this.points < 30){
            //If number of cards is odd, add an extra point to round up 
            let gainedPoints = nc % 2 == 0 ? (nc - 20) + 6: (nc-20) + 7
            this.points += gainedPoints
        }
    }

    // Checks if a players has 3 or 4 of a kind
    check3or4(){
        for (let n = 0; n < 2; n ++){
            
            let cardList = []
            for (let i = 0; i < 6; i++){
            
                cardList += translate(this.players[n].deck.cards[i])
          }
          
          let ucards = set(cardList)
          if (6 - ucards.length == 3) {
            
            //This should trigger a win
          } else if (6- uncards.length == 4 && this.checkPoints()) {
            
            this.points += 2
          } 
        }
      } 

      checkPoints() {
          if (this.points = 38) return false;
          else return true
      }
            
}

