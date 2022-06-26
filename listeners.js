const createGameBtn = document.querySelector("button[name='create']");
const joinGameBtn = document.querySelector("button[name='join']");
const playerTable = document.getElementById('playerList');

//Show option to create a game
createGameBtn.addEventListener("click", function() {
    document.getElementById("choose-game-creation-option").style.display = "none";
    document.getElementById("create-game").style.display = "block";
});

//Show option to join a game
joinGameBtn.addEventListener("click", function() {
    document.getElementById("choose-game-creation-option").style.display = "none";
    document.getElementById("join-game").style.display = "block";
});




// playerTable.children.forEach((child) => {
//     child.addEventListener('click', function() {
//         if ()
//     });
// });


// window.onload = function() {
//     document.querySelector('.user-hand').children.onmousedown = startDrag;
//     document.querySelector('.user-hand').children.onmouseup = stopDrag;
// }