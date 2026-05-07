import { Injectable } from '@angular/core';
import { GameEngineService, PieceType } from './game-engine.service';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

@Injectable({
  providedIn: 'root'
})
export class AiService {

  constructor(private engine: GameEngineService) { }

  makeMove(board: PieceType[][][], aiColor: 'black' | 'white', difficulty: AIDifficulty, round: number, cooldown: number): { x: number, z: number, useSkill: boolean } {
    let useSkill = false;

    // Hard AI and Normal AI might use skills
    if (difficulty === 'hard' && round >= 5 && cooldown === 0) {
      if (Math.random() < 0.3) { // 30% chance to use skill if available
        useSkill = true;
      }
    }

    const validMoves: {x: number, z: number}[] = [];
    for (let x = 0; x < this.engine.BOARD_SIZE; x++) {
      for (let z = 0; z < this.engine.BOARD_SIZE; z++) {
        if (this.engine.getTopY(board, x, z) !== -1) {
          validMoves.push({x, z});
        }
      }
    }

    if (validMoves.length === 0) {
      return { x: -1, z: -1, useSkill: false };
    }

    const opponentColor: 'black' | 'white' = aiColor === 'black' ? 'white' : 'black';

    let bestMove = validMoves[0];
    let maxScore = -Infinity;

    for (const move of validMoves) {
      const y = this.engine.getTopY(board, move.x, move.z);
      let score = 0;

      // Easy: Flat only, 80% attack, 20% defense
      if (difficulty === 'easy') {
        const attackScore = this.evaluateLines(board, move.x, y, move.z, aiColor, true); // true = flat only
        const defenseScore = this.evaluateLines(board, move.x, y, move.z, opponentColor, true);
        score = (attackScore * 0.8) + (defenseScore * 0.2) + Math.random();
      }
      // Normal: Flat + 3D, 60% attack, 40% defense
      else if (difficulty === 'normal') {
        const attackScore = this.evaluateLines(board, move.x, y, move.z, aiColor, false);
        const defenseScore = this.evaluateLines(board, move.x, y, move.z, opponentColor, false);
        score = (attackScore * 0.6) + (defenseScore * 0.4) + Math.random();
      }
      // Hard: Flat + 3D, 50% attack, 50% defense + center bias
      else {
        const attackScore = this.evaluateLines(board, move.x, y, move.z, aiColor, false);
        const defenseScore = this.evaluateLines(board, move.x, y, move.z, opponentColor, false);

        // Center bias
        const centerX = Math.floor(this.engine.BOARD_SIZE / 2);
        const centerZ = Math.floor(this.engine.BOARD_SIZE / 2);
        const centerScore = 10 - (Math.abs(move.x - centerX) + Math.abs(move.z - centerZ));

        score = (attackScore * 0.5) + (defenseScore * 0.5) + centerScore + Math.random();
      }

      // Check immediate win/loss (highest priority for all levels but easy is less smart)
      if (difficulty !== 'easy') {
         board[move.x][move.z][y] = aiColor;
         if (this.engine.checkWin(board, move.x, y, move.z, aiColor)) score += 100000;
         board[move.x][move.z][y] = opponentColor;
         if (this.engine.checkWin(board, move.x, y, move.z, opponentColor)) score += 50000;
         board[move.x][move.z][y] = null;
      }

      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
    }

    return { ...bestMove, useSkill };
  }

  // Simple heuristic: count consecutive pieces in all directions if we place a piece here
  private evaluateLines(board: PieceType[][][], x: number, y: number, z: number, color: 'black' | 'white', flatOnly: boolean): number {
    let score = 0;

    // Flat directions
    const flatDirs = [ [1,0,0], [0,0,1], [1,0,1], [1,0,-1] ];
    const threedDirs = [
      [0,1,0], [1,1,0], [-1,1,0], [0,1,1], [0,1,-1],
      [1,1,1], [-1,1,1], [1,1,-1], [-1,1,-1]
    ];

    const dirs = flatOnly ? flatDirs : [...flatDirs, ...threedDirs];

    for (const [dx, dy, dz] of dirs) {
      let count = 1;
      // Forward
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i, ny = y + dy * i, nz = z + dz * i;
        if (nx>=0 && nx<this.engine.BOARD_SIZE && ny>=0 && ny<this.engine.MAX_HEIGHT && nz>=0 && nz<this.engine.BOARD_SIZE) {
          if (board[nx][nz][ny] === color) count++;
          else if (board[nx][nz][ny] !== null) break; // blocked
        } else break;
      }
      // Backward
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i, ny = y - dy * i, nz = z - dz * i;
        if (nx>=0 && nx<this.engine.BOARD_SIZE && ny>=0 && ny<this.engine.MAX_HEIGHT && nz>=0 && nz<this.engine.BOARD_SIZE) {
          if (board[nx][nz][ny] === color) count++;
          else if (board[nx][nz][ny] !== null) break; // blocked
        } else break;
      }

      if (count === 2) score += 10;
      if (count === 3) score += 100;
      if (count === 4) score += 1000;
    }

    return score;
  }
}
