import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameBoardComponent } from '../game-board/game-board.component';
import { GameEngineService, PieceType } from '../../services/game-engine.service';
import { AiService, AIDifficulty } from '../../services/ai.service';
import { FirebaseService, Room } from '../../services/firebase.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, GameBoardComponent],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, OnDestroy {
  mode: 'single' | 'multi' = 'single';
  roomId: string | null = null;

  board: PieceType[][][] = [];
  currentTurn: 'black' | 'white' = 'black';
  round: number = 1;
  winner: string | null = null;
  winType: string | null = null;

  localColor: 'black' | 'white' = 'black'; // for single player, player is always black
  aiDifficulty: AIDifficulty = 'normal';

  // Events
  blackCooldown = 0;
  whiteCooldown = 0;
  activeEventMsg: string | null = null;
  cameraRotation = 0;

  isInteractable = true;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private engine: GameEngineService,
    private ai: AiService,
    private firebase: FirebaseService,
    private cdr: ChangeDetectorRef
  ) {
    this.board = this.engine.createEmptyBoard();
  }

  ngOnInit() {
    this.mode = this.route.snapshot.paramMap.get('mode') as 'single' | 'multi';

    if (this.mode === 'single') {
      this.aiDifficulty = (this.route.snapshot.queryParamMap.get('difficulty') as AIDifficulty) || 'normal';
      this.startGame();
    } else {
      this.roomId = this.route.snapshot.paramMap.get('roomId');
      if (!this.roomId) {
         this.router.navigate(['/']);
         return;
      }
      this.setupMultiplayer();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  private setupMultiplayer() {
    this.unsubscribe = this.firebase.listenToRoom(this.roomId!, (room: Room) => {
      // Restore state from Firebase
      if (room.gameState.board && room.gameState.board.length > 0) {
        this.board = room.gameState.board;
      }
      this.currentTurn = room.gameState.currentTurn;
      this.round = room.gameState.round;
      this.winner = room.gameState.winner;
      this.winType = room.gameState.winType;
      this.blackCooldown = room.gameState.events.blackCooldown;
      this.whiteCooldown = room.gameState.events.whiteCooldown;

      const pInfo = room.players[this.firebase.localPlayerId];
      if (pInfo && pInfo.color) {
        this.localColor = pInfo.color;
      }

      this.isInteractable = (this.currentTurn === this.localColor) && !this.winner;
      this.cdr.detectChanges();
    });
  }

  startGame() {
    this.board = this.engine.createEmptyBoard();
    this.currentTurn = 'black';
    this.round = 1;
    this.winner = null;
    this.winType = null;
    this.blackCooldown = 0;
    this.whiteCooldown = 0;
    this.cameraRotation = 0;
    this.isInteractable = true;

    if (this.mode === 'multi' && this.roomId) {
      // Reset logic handled by host if needed, simplified here
    }
  }

  async onCellClick(pos: {x: number, z: number}) {
    if (!this.isInteractable || this.winner || this.currentTurn !== this.localColor) return;

    this.isInteractable = false; // Prevent multiple clicks

    // 1. Process Turn Start Random Event (From Round 5)
    await this.checkRandomEvent();

    // 2. Place piece
    const placedY = this.engine.placePiece(this.board, pos.x, pos.z, this.currentTurn);
    if (placedY === -1) {
      this.isInteractable = true;
      return; // Column full
    }

    // Clone board to trigger change detection for child component
    this.board = [...this.board];

    // 3. Check win
    const winResult = this.engine.checkWin(this.board, pos.x, placedY, pos.z, this.currentTurn);
    if (winResult) {
      this.winner = winResult.winner;
      this.winType = winResult.type;
      await this.syncState();
      return;
    }

    this.endTurn();
  }

  private async checkRandomEvent() {
    if (this.round >= 5) {
      const event = this.engine.triggerRandomEvent(this.board, 0.05); // 5% chance
      if (event) {
        this.showEventMessage(`隨機事件觸發！貓咪使出了：${this.getEventName(event.type)}`);
        this.applyEventVisuals(event);
        this.board = [...this.board];
        await this.syncState();
        // Wait a moment for player to see event
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  async useSkill() {
    if (!this.canUseSkill()) return;

    if (this.currentTurn === 'black') this.blackCooldown = 10;
    else this.whiteCooldown = 10;

    // Force trigger an event
    const event = this.engine.triggerRandomEvent(this.board, 1.0); // 100% chance
    if (event) {
      this.showEventMessage(`你使用了技能！貓咪使出了：${this.getEventName(event.type)}`);
      this.applyEventVisuals(event);
      this.board = [...this.board];
      await this.syncState();
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  canUseSkill(): boolean {
    if (this.winner) return false;
    if (this.round < 10) return false; // Available after round 10
    if (this.mode === 'single' && this.currentTurn !== 'black') return false; // Only player can click in single
    if (this.mode === 'multi' && this.currentTurn !== this.localColor) return false;

    if (this.currentTurn === 'black') return this.blackCooldown === 0;
    return this.whiteCooldown === 0;
  }

  getSkillCooldown(): number {
    return this.localColor === 'black' ? this.blackCooldown : this.whiteCooldown;
  }

  private applyEventVisuals(event: any) {
    if (event.type === 'parkour') {
      this.cameraRotation += event.data.angle;
    }
  }

  private getEventName(type: string): string {
    if (type === 'swipe') return '大手一揮 🐾 (棋子掉落)';
    if (type === 'box') return '最愛紙箱 📦 (佔據空間)';
    return '跑酷 🐈‍⬛ (視角旋轉)';
  }

  private showEventMessage(msg: string) {
    this.activeEventMsg = msg;
    setTimeout(() => {
      this.activeEventMsg = null;
      this.cdr.detectChanges();
    }, 3000);
  }

  private async endTurn() {
    // Reduce cooldowns
    if (this.currentTurn === 'black') {
      if (this.blackCooldown > 0) this.blackCooldown--;
    } else {
      if (this.whiteCooldown > 0) this.whiteCooldown--;
      this.round++; // Round increments after white's turn
    }

    this.currentTurn = this.currentTurn === 'black' ? 'white' : 'black';

    if (this.mode === 'multi') {
      await this.syncState();
    } else {
      // Single Player AI Turn
      if (this.currentTurn === 'white' && !this.winner) {
        setTimeout(() => this.playAITurn(), 500);
      } else {
        this.isInteractable = true;
      }
    }
  }

  private async playAITurn() {
    await this.checkRandomEvent();
    if (this.winner) return;

    const aiMove = this.ai.makeMove(this.board, 'white', this.aiDifficulty, this.round, this.whiteCooldown);

    if (aiMove.useSkill) {
      this.whiteCooldown = 10;
      const event = this.engine.triggerRandomEvent(this.board, 1.0);
      if (event) {
        this.showEventMessage(`AI 使用了技能！：${this.getEventName(event.type)}`);
        this.applyEventVisuals(event);
        this.board = [...this.board];
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (aiMove.x !== -1) {
      const placedY = this.engine.placePiece(this.board, aiMove.x, aiMove.z, 'white');
      this.board = [...this.board];
      if (placedY !== -1) {
        const winResult = this.engine.checkWin(this.board, aiMove.x, placedY, aiMove.z, 'white');
        if (winResult) {
          this.winner = winResult.winner;
          this.winType = winResult.type;
          return;
        }
      }
    }

    this.endTurn();
  }

  private async syncState() {
    if (this.mode === 'multi' && this.roomId) {
      await this.firebase.updateGameState(this.roomId, {
        board: this.board,
        currentTurn: this.currentTurn,
        round: this.round,
        winner: this.winner as any,
        winType: this.winType as any,
        events: {
          blackCooldown: this.blackCooldown,
          whiteCooldown: this.whiteCooldown,
          activeEvent: null
        }
      });
    }
  }

  exitGame() {
    this.router.navigate(['/']);
  }
}
