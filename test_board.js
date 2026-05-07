const board = [];
for (let x = 0; x < 11; x++) {
  const colZ = [];
  for (let z = 0; z < 11; z++) {
    const colY = [];
    for (let y = 0; y < 9; y++) {
      colY.push(null);
    }
    colZ.push(colY);
  }
  board.push(colZ);
}
board[5][5][0] = 'black';
const str = JSON.stringify(board);
console.log(str.length);
const parsed = JSON.parse(str);
console.log(parsed[5][5][0]);
