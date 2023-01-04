import { useState} from 'react';

function PlayerTable(props) {
    function PlayerRow(props) {
        const [color, setColor] = useState("");
        function updateColor() {
            if (color === '') {
              setColor('red');
            } else if (color === 'red') {
              setColor('blue');
            } else if (color === 'blue') {
              setColor("");
            }
        }
        return (<tr value={props.sessionPlayers[props.num].playerId} style={{backgroundColor : color}} onClick={() => {if (props.host) {updateColor()}} }> 
            <td> {props.sessionPlayers[props.num].name} </td>
        </tr>);
    }

    return (<table className="player-list" id = {props.id}> 
    <PlayerRow host={props.host} sessionPlayers={props.sessionPlayers} num={1}> </PlayerRow>
    <PlayerRow host={props.host} sessionPlayers={props.sessionPlayers} num={2}> </PlayerRow>
    <PlayerRow host={props.host} sessionPlayers={props.sessionPlayers} num={3}> </PlayerRow>
    <PlayerRow host={props.host} sessionPlayers={props.sessionPlayers} num={4}> </PlayerRow>
  </table>);
}
export default PlayerTable;