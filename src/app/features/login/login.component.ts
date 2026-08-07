import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.loadGoogleScript();
  }

  private loadGoogleScript(): void {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      this.initGsi();
      return;
    }

    if (document.getElementById('gsi-client-script')) return;

    const script = document.createElement('script');
    script.id = 'gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.initGsi();
    script.onerror = () => this.error.set('No se pudo establecer conexión con los servidores de Google.');
    document.head.appendChild(script);
  }

  private initGsi(): void {
    try {
      const google = (window as any).google;
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.handleCredentialResponse(response),
        cancel_on_tap_outside: true,
      });

      const btnContainer = document.getElementById('googleBtn');
      if (btnContainer) {
        google.accounts.id.renderButton(btnContainer, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: '100%',
          shape: 'pill',
          logo_alignment: 'center',
          text: 'continue_with'
        });
      }
    } catch {
      this.error.set('Error crítico del sistema al cargar autenticación.');
    }
  }

  private async handleCredentialResponse(response: any): Promise<void> {
    const credential = response?.credential;
    if (!credential) {
      this.error.set('Autenticación cancelada o incompleta.');
      this.isLoading.set(false);
      return;
    }

    try {
      this.isLoading.set(true);
      this.error.set('');
      await this.auth.loginWithBackend(credential);

      const rol = this.auth.user()?.rol;

      if ((rol === 'ESTUDIANTE' || rol === 'INVITADO') && !this.auth.perfilCompleto()) {
        await this.router.navigate(['/completar-perfil']);
      } else if (rol === 'ESTUDIANTE' || rol === 'INVITADO') {
        await this.router.navigate(['/estudiante/inicio']);
      } else {
        await this.router.navigate(['/admin/dashboard']);
      }
    } catch (err: any) {
      this.error.set(err?.message ?? 'Servicio temporalmente inactivo. Intente más tarde.');
    } finally {
      this.isLoading.set(false);
    }
  }
}