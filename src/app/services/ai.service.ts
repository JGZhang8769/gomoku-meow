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

    if (difficulty === 'easy') {
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      return { ...move, useSkill };
    }

    const opponentColor: 'black' | 'white' = aiColor === 'black' ? 'white' : 'black';

    // Normal & Hard: Check for immediate win or immediate block
    // 1. Can I win?
    for (const move of validMoves) {
      const y = this.engine.getTopY(board, move.x, move.z);
      board[move.x][move.z][y] = aiColor;
      if (this.engine.checkWin(board, move.x, y, move.z, aiColor)) {
        board[move.x][move.z][y] = null; // Revert
        return { ...move, useSkill };
      }
      board[move.x][move.z][y] = null; // Revert
    }

    // 2. Do I need to block opponent's immediate win?
    for (const move of validMoves) {
      const y = this.engine.getTopY(board, move.x, move.z);
      board[move.x][move.z][y] = opponentColor;
      if (this.engine.checkWin(board, move.x, y, move.z, opponentColor)) {
        board[move.x][move.z][y] = null; // Revert
        return { ...move, useSkill };
      }
      board[move.x][move.z][y] = null; // Revert
    }

    if (difficulty === 'normal') {
      // Pick random if no immediate threat or win
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      return { ...move, useSkill };
    }

    // Hard: Evaluate moves slightly better (center bias)
    // Very basic heuristic for Hard AI
    let bestMove = validMoves[0];
    let minDistance = 999;
    const centerX = Math.floor(this.engine.BOARD_SIZE / 2);
    const centerZ = Math.floor(this.engine.BOARD_SIZE / 2);

    for (const move of validMoves) {
       const dist = Math.abs(move.x - centerX) + Math.abs(move.z - centerZ);
       // Add some randomness to hard AI
       const score = dist + Math.random() * 2;
       if (score < minDistance) {
         minDistance = score;
         bestMove = move;
       }
    }

    return { ...bestMove, useSkill };
  }
}
