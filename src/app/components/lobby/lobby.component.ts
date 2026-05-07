import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent {
  roomCode: string = '';
  isJoining: boolean = false;
  errorMsg: string = '';

  constructor(private router: Router, private firebaseService: FirebaseService) {}

  async createRoom() {
    try {
      const roomId = await this.firebaseService.createRoom('My Room');
      this.router.navigate(['/room', roomId]);
    } catch (e) {
      this.errorMsg = '無法建立房間';
    }
  }

  async joinRoom() {
    if (!this.roomCode) return;
    this.isJoining = true;
    this.errorMsg = '';
    const code = this.roomCode.toUpperCase().trim();

    try {
      const result = await this.firebaseService.joinRoom(code);
      if (result.success) {
        if (result.playing) {
          // Reconnect directly to game
          this.router.navigate(['/game', 'multi', code]);
        } else {
          this.router.navigate(['/room', code]);
        }
      } else {
        this.errorMsg = '房間不存在或已滿';
      }
    } catch (e) {
      this.errorMsg = '連線錯誤';
    }
    this.isJoining = false;
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
