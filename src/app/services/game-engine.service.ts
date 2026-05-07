import { Injectable } from '@angular/core';

export type PieceType = 'black' | 'white' | 'box' | null;

export interface BoardCell {
  x: number;
  y: number; // Vertical height 0-8
  z: number;
  type: PieceType;
}

export interface WinResult {
  winner: 'black' | 'white';
  type: '5-in-a-row' | '4-in-a-row-3d' | 'perfect-win';
  winningCells: {x: number, y: number, z: number}[];
}

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  readonly BOARD_SIZE = 11;
  readonly MAX_HEIGHT = 9;

  constructor() {}

  createEmptyBoard(): PieceType[][][] {
    const board: PieceType[][][] = [];
    for (let x = 0; x < this.BOARD_SIZE; x++) {
      const colZ: PieceType[][] = [];
      for (let z = 0; z < this.BOARD_SIZE; z++) {
        const colY: PieceType[] = [];
        for (let y = 0; y < this.MAX_HEIGHT; y++) {
          colY.push(null);
        }
        colZ.push(colY);
      }
      board.push(colZ);
    }
    return board;
  }

  // Find the highest available y-level at (x, z)
  getTopY(board: PieceType[][][], x: number, z: number): number {
    for (let y = 0; y < this.MAX_HEIGHT; y++) {
      if (board[x][z][y] === null) {
        return y;
      }
    }
    return -1; // Column full
  }

  placePiece(board: PieceType[][][], x: number, z: number, type: PieceType): number {
    const y = this.getTopY(board, x, z);
    if (y !== -1) {
      board[x][z][y] = type;
      return y;
    }
    return -1;
  }

  checkWin(board: PieceType[][][], lastX: number, lastY: number, lastZ: number, player: 'black' | 'white'): WinResult | null {
    if (board[lastX][lastZ][lastY] !== player) return null;

    let flatWinCells = this.checkFlatWin(board, lastX, lastY, lastZ, player);
    let verticalWinCells = this.check3DWin(board, lastX, lastY, lastZ, player);

    if (flatWinCells.length > 0 && verticalWinCells.length > 0) {
      return { winner: player, type: 'perfect-win', winningCells: [...flatWinCells, ...verticalWinCells] };
    } else if (flatWinCells.length > 0) {
      return { winner: player, type: '5-in-a-row', winningCells: flatWinCells };
    } else if (verticalWinCells.length > 0) {
      return { winner: player, type: '4-in-a-row-3d', winningCells: verticalWinCells };
    }

    return null;
  }

  private checkFlatWin(board: PieceType[][][], startX: number, startY: number, startZ: number, player: 'black' | 'white'): {x: number, y: number, z: number}[] {
    const directions = [
      [1, 0], // x
      [0, 1], // z
      [1, 1], // diagonal + +
      [1, -1] // diagonal + -
    ];

    for (const [dx, dz] of directions) {
      let count = 1;
      let winningCells = [{x: startX, y: startY, z: startZ}];

      // Forward
      for (let i = 1; i < 5; i++) {
        const nx = startX + dx * i;
        const nz = startZ + dz * i;
        if (nx >= 0 && nx < this.BOARD_SIZE && nz >= 0 && nz < this.BOARD_SIZE && board[nx][nz][startY] === player) {
          count++;
          winningCells.push({x: nx, y: startY, z: nz});
        } else {
          break;
        }
      }

      // Backward
      for (let i = 1; i < 5; i++) {
        const nx = startX - dx * i;
        const nz = startZ - dz * i;
        if (nx >= 0 && nx < this.BOARD_SIZE && nz >= 0 && nz < this.BOARD_SIZE && board[nx][nz][startY] === player) {
          count++;
          winningCells.push({x: nx, y: startY, z: nz});
        } else {
          break;
        }
      }

      if (count >= 5) {
        return winningCells;
      }
    }

    return [];
  }

  private check3DWin(board: PieceType[][][], startX: number, startY: number, startZ: number, player: 'black' | 'white'): {x: number, y: number, z: number}[] {
    const directions = [
      [0, 1, 0], // vertical y
      [1, 1, 0], // diagonal x, y
      [-1, 1, 0], // diagonal -x, y
      [0, 1, 1], // diagonal z, y
      [0, 1, -1], // diagonal -z, y
      [1, 1, 1], // 3D diagonal
      [-1, 1, 1], // 3D diagonal
      [1, 1, -1], // 3D diagonal
      [-1, 1, -1] // 3D diagonal
    ];

    for (const [dx, dy, dz] of directions) {
      let count = 1;
      let winningCells = [{x: startX, y: startY, z: startZ}];

      // Forward
      for (let i = 1; i < 4; i++) {
        const nx = startX + dx * i;
        const ny = startY + dy * i;
        const nz = startZ + dz * i;
        if (nx >= 0 && nx < this.BOARD_SIZE && ny >= 0 && ny < this.MAX_HEIGHT && nz >= 0 && nz < this.BOARD_SIZE && board[nx][nz][ny] === player) {
          count++;
          winningCells.push({x: nx, y: ny, z: nz});
        } else {
          break;
        }
      }

      // Backward
      for (let i = 1; i < 4; i++) {
        const nx = startX - dx * i;
        const ny = startY - dy * i;
        const nz = startZ - dz * i;
        if (nx >= 0 && nx < this.BOARD_SIZE && ny >= 0 && ny < this.MAX_HEIGHT && nz >= 0 && nz < this.BOARD_SIZE && board[nx][nz][ny] === player) {
          count++;
          winningCells.push({x: nx, y: ny, z: nz});
        } else {
          break;
        }
      }

      if (count >= 4) {
        return winningCells;
      }
    }

    return [];
  }

  // --- Cat Disruption Events ---

  triggerRandomEvent(board: PieceType[][][], chance: number = 0.05): {type: 'swipe' | 'box' | 'parkour', data: any} | null {
    if (Math.random() > chance) return null;

    const eventTypes: ('swipe' | 'box' | 'parkour')[] = ['swipe', 'box', 'parkour'];
    const selectedEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    return this.applyEvent(board, selectedEvent);
  }

  applyEvent(board: PieceType[][][], type: 'swipe' | 'box' | 'parkour'): {type: 'swipe' | 'box' | 'parkour', data: any} {
    if (type === 'swipe') {
      return { type, data: this.applyCatSwipe(board) };
    } else if (type === 'box') {
      return { type, data: this.applyCatBox(board) };
    } else {
      return { type, data: this.applyCatParkour() };
    }
  }

  private applyCatSwipe(board: PieceType[][][]): any {
    // Randomly remove 5~20% of the pieces
    let pieceCount = 0;
    const pieces: {x: number, y: number, z: number}[] = [];

    for (let x = 0; x < this.BOARD_SIZE; x++) {
      for (let z = 0; z < this.BOARD_SIZE; z++) {
        for (let y = 0; y < this.MAX_HEIGHT; y++) {
          if (board[x][z][y] !== null && board[x][z][y] !== 'box') {
            pieceCount++;
            pieces.push({x, y, z});
          }
        }
      }
    }

    if (pieceCount === 0) return { removed: [] };

    const removePercent = 0.05 + Math.random() * 0.15; // 5% ~ 20%
    const removeCount = Math.max(1, Math.floor(pieceCount * removePercent));

    // Shuffle and pick
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    const removedPieces = pieces.slice(0, removeCount);
    for (const p of removedPieces) {
      board[p.x][p.z][p.y] = null;
    }

    // Apply gravity
    this.applyGravity(board);

    return { removedCount: removeCount };
  }

  private applyGravity(board: PieceType[][][]) {
    for (let x = 0; x < this.BOARD_SIZE; x++) {
      for (let z = 0; z < this.BOARD_SIZE; z++) {
        let writeY = 0;
        for (let readY = 0; readY < this.MAX_HEIGHT; readY++) {
          if (board[x][z][readY] !== null) {
            if (writeY !== readY) {
              board[x][z][writeY] = board[x][z][readY];
              board[x][z][readY] = null;
            }
            writeY++;
          }
        }
      }
    }
  }

  private applyCatBox(board: PieceType[][][]): any {
    // Drop a box randomly on the board
    const availablePositions = [];
    for (let x = 0; x < this.BOARD_SIZE; x++) {
      for (let z = 0; z < this.BOARD_SIZE; z++) {
        const topY = this.getTopY(board, x, z);
        if (topY !== -1) {
          availablePositions.push({x, z});
        }
      }
    }

    if (availablePositions.length === 0) return { dropped: false };

    const randomPos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
    this.placePiece(board, randomPos.x, randomPos.z, 'box');
    return { dropped: true, x: randomPos.x, z: randomPos.z };
  }

  private applyCatParkour(): any {
    // Rotate camera 90, 180, or 270 degrees
    const angles = [90, 180, 270];
    const rotateAngle = angles[Math.floor(Math.random() * angles.length)];
    return { angle: rotateAngle };
  }
}
