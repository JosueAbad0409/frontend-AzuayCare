import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class Dashboard {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}