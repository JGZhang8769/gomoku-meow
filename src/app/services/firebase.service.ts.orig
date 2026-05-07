import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface PlayerInfo {
  id: string;
  ready: boolean;
  color: 'black' | 'white' | null;
}

export interface GameState {
  board: string; // 3D array of piece information, stringified to avoid nested array errors
  currentTurn: 'black' | 'white';
  round: number;
  status: 'waiting' | 'countdown' | 'playing' | 'ended';
  winner: 'black' | 'white' | null;
  winType: '5-in-a-row' | '4-in-a-row-3d' | 'perfect-win' | null;
  cameraRotation: number;
  events: {
    blackCooldown: number;
    whiteCooldown: number;
    lastEvent: {
      type: 'swipe' | 'box' | 'parkour';
      data: any;
      timestamp: number;
    } | null;
  };
}

export interface Room {
  id: string;
  name: string;
  players: Record<string, PlayerInfo>;
  gameState: GameState;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  app: FirebaseApp;
  db: Firestore;

  // A simple local random ID for the current session
  localPlayerId: string;

  constructor() {
    this.app = initializeApp(environment.firebaseConfig);
    this.db = getFirestore(this.app);
    this.localPlayerId = this.getOrCreatePlayerId();
  }

  private getOrCreatePlayerId(): string {
    const storedId = localStorage.getItem('gomoku_player_id');
    if (storedId) {
      return storedId;
    }
    const newId = Math.random().toString(36).substring(2, 9);
    localStorage.setItem('gomoku_player_id', newId);
    return newId;
  }

  getEmptyGameState(): GameState {
    return {
      board: '[]', // We'll initialize this as 11x11x9
      currentTurn: 'black',
      round: 1,
      status: 'waiting',
      winner: null,
      winType: null,
      cameraRotation: 0,
      events: {
        blackCooldown: 0,
        whiteCooldown: 0,
        lastEvent: null
      }
    };
  }

  async createRoom(roomName: string): Promise<string> {
    const roomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const roomRef = doc(this.db, 'rooms', roomId);

    const room: Room = {
      id: roomId,
      name: roomName,
      players: {
        [this.localPlayerId]: {
          id: this.localPlayerId,
          ready: false,
          color: null // Will be assigned when game starts
        }
      },
      gameState: this.getEmptyGameState(),
      createdAt: Date.now()
    };

    await setDoc(roomRef, room);
    return roomId;
  }

  async joinRoom(roomId: string): Promise<{ success: boolean, playing: boolean }> {
    const roomRef = doc(this.db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as Room;

      // If player is already in this room
      if (roomData.players[this.localPlayerId]) {
         return { success: true, playing: roomData.gameState.status === 'playing' };
      }

      if (Object.keys(roomData.players).length >= 2) {
        return { success: false, playing: false }; // Room full
      }

      const updateData = {
        [`players.${this.localPlayerId}`]: {
          id: this.localPlayerId,
          ready: false,
          color: null
        }
      };

      await updateDoc(roomRef, updateData);
      return { success: true, playing: roomData.gameState.status === 'playing' };
    }
    return { success: false, playing: false };
  }

  listenToRoom(roomId: string, callback: (room: Room) => void): () => void {
    const roomRef = doc(this.db, 'rooms', roomId);
    return onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as Room);
      }
    });
  }

  async setReady(roomId: string, ready: boolean) {
    const roomRef = doc(this.db, 'rooms', roomId);
    await updateDoc(roomRef, {
      [`players.${this.localPlayerId}.ready`]: ready
    });
  }

  async updateGameState(roomId: string, gameState: Partial<GameState>) {
    const roomRef = doc(this.db, 'rooms', roomId);
    const updateData: any = {};
    for (const key of Object.keys(gameState)) {
      updateData[`gameState.${key}`] = (gameState as any)[key];
    }
    await updateDoc(roomRef, updateData);
  }

  async updateRoom(roomId: string, updateData: any) {
    const roomRef = doc(this.db, 'rooms', roomId);
    await updateDoc(roomRef, updateData);
  }

  async leaveRoom(roomId: string) {
    const roomRef = doc(this.db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as Room;
      const newPlayers = { ...roomData.players };
      delete newPlayers[this.localPlayerId];
      await updateDoc(roomRef, { players: newPlayers });
    }
  }
}
