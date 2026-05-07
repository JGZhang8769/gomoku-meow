import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseService, Room } from '../../services/firebase.service';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit, OnDestroy {
  roomId: string = '';
  room: Room | null = null;
  localPlayerId: string = '';
  unsubscribe: (() => void) | null = null;

  isReady: boolean = false;
  countdown: number = 5;
  countdownInterval: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firebaseService: FirebaseService
  ) {
    this.localPlayerId = this.firebaseService.localPlayerId;
  }

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) {
      this.router.navigate(['/lobby']);
      return;
    }

    this.unsubscribe = this.firebaseService.listenToRoom(this.roomId, (roomData) => {
      this.room = roomData;

      // Check if both ready and start countdown if needed
      const players = Object.values(this.room.players);
      if (players.length === 2 && players.every(p => p.ready) && this.room.gameState.status === 'waiting') {
        this.startCountdown();
      } else if (this.room.gameState.status === 'playing') {
        this.router.navigate(['/game', 'multi', this.roomId]);
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  toggleReady() {
    this.isReady = !this.isReady;
    this.firebaseService.setReady(this.roomId, this.isReady);
  }

  private startCountdown() {
    if (this.countdownInterval || this.room?.gameState.status === 'countdown') return;

    // Only one player updates the room status to avoid race conditions
    const playerIds = Object.keys(this.room!.players).sort();
    if (this.localPlayerId === playerIds[0]) {
       this.firebaseService.updateGameState(this.roomId, { status: 'countdown' });
    }

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        if (this.localPlayerId === playerIds[0]) {
          // Assign colors and start
          const p1 = playerIds[0];
          const p2 = playerIds[1];
          // random color
          const p1Color = Math.random() > 0.5 ? 'black' : 'white';
          const p2Color = p1Color === 'black' ? 'white' : 'black';

          this.firebaseService.updateRoom(this.roomId, {
            [`players.${p1}.color`]: p1Color,
            [`players.${p2}.color`]: p2Color,
            'gameState.status': 'playing'
          });
        }
      }
    }, 1000);
  }

  copyCode() {
    navigator.clipboard.writeText(this.roomId);
    alert('邀請碼已複製！');
  }

  leaveRoom() {
    this.router.navigate(['/lobby']);
  }
}
