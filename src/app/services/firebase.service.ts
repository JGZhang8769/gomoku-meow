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
  board: any[]; // 3D array of piece information
  currentTurn: 'black' | 'white';
  round: number;
  status: 'waiting' | 'countdown' | 'playing' | 'ended';
  winner: 'black' | 'white' | null;
  winType: '5-in-a-row' | '4-in-a-row-3d' | 'perfect-win' | null;
  events: {
    blackCooldown: number;
    whiteCooldown: number;
    activeEvent: 'swipe' | 'box' | 'parkour' | null;
    eventData?: any;
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
    this.localPlayerId = this.generateId();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  getEmptyGameState(): GameState {
    return {
      board: [], // We'll initialize this as 11x11x9
      currentTurn: 'black',
      round: 1,
      status: 'waiting',
      winner: null,
      winType: null,
      events: {
        blackCooldown: 0,
        whiteCooldown: 0,
        activeEvent: null
      }
    };
  }

  async createRoom(roomName: string): Promise<string> {
    const roomId = this.generateId().toUpperCase();
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

  async joinRoom(roomId: string): Promise<boolean> {
    const roomRef = doc(this.db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as Room;
      if (Object.keys(roomData.players).length >= 2 && !roomData.players[this.localPlayerId]) {
        return false; // Room full
      }

      const updateData = {
        [`players.${this.localPlayerId}`]: {
          id: this.localPlayerId,
          ready: false,
          color: null
        }
      };

      await updateDoc(roomRef, updateData);
      return true;
    }
    return false;
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
}
