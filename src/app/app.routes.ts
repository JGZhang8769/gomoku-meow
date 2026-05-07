import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LobbyComponent } from './components/lobby/lobby.component';
import { RoomComponent } from './components/room/room.component';
import { GameComponent } from './components/game/game.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'lobby', component: LobbyComponent },
  { path: 'room/:id', component: RoomComponent },
  { path: 'game/:mode', component: GameComponent }, // mode: single|multi
  { path: 'game/:mode/:roomId', component: GameComponent },
  { path: '**', redirectTo: '' }
];
