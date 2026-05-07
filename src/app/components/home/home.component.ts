import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  aiDifficulty: 'easy' | 'normal' | 'hard' = 'normal';

  constructor(private router: Router) {}

  startSinglePlayer() {
    this.router.navigate(['/game', 'single'], { queryParams: { difficulty: this.aiDifficulty }});
  }

  goToLobby() {
    this.router.navigate(['/lobby']);
  }
}