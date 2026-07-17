import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router); // Inyectamos el Router aquí

  logout() {
    this.auth.logout();              // Limpia el token y el usuario en el servicio
    this.router.navigate(['/login']); // Redirige físicamente al Login
  }
}