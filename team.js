export default class Team {
    constructor(players,points,teamCards){
        this.players = players;
        this.points = 0;
        this.teamCards = [];
    }

    addpoints(gained){
        this.points += gained
    }
}

class Players{
    constructor(deck){
        this.deck = [];
    }

}