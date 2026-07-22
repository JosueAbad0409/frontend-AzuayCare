import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

const GOOGLE_CLIENT_ID = '474214477775-m9ci1dg4p6i20s7548et5sfto14750lp.apps.googleusercontent.com';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  host: {
    style: "--bg-image: url('/images/tec-azuay-inicio-sesion.jpg');"
  }
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  isLoading = signal<boolean>(false);
  error = signal<string>('');

  ngOnInit() {
    this.loadGoogleScript();
  }

  private loadGoogleScript() {
    if ((window as any).google?.accounts?.id) {
      this.initGsi();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.initGsi();
    script.onerror = () => this.error.set('No se pudo cargar el servicio de autenticación de Google.');
    document.head.appendChild(script);
  }

  private initGsi() {
    try {
      const google = (window as any).google;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: any) => this.handleCredentialResponse(response),
        cancel_on_tap_outside: true,
      });

      google.accounts.id.renderButton(
        document.getElementById('googleBtn'),
        { theme: 'outline', size: 'large', width: '100%', shape: 'rectangular' }
      );
    } catch {
      this.error.set('Error al inicializar el servicio de Google.');
    }
  }

  private async handleCredentialResponse(response: any) {
    const credential: string | undefined = response?.credential;
    if (!credential) {
      this.error.set('No se recibió la credencial de acceso desde Google.');
      this.isLoading.set(false);
      return;
    }

    try {
      this.isLoading.set(true);
      this.error.set('');
      await this.auth.loginWithBackend(credential);
      await this.router.navigate(['/home']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Ocurrió un error al iniciar sesión en el servidor.');
    } finally {
      this.isLoading.set(false);
    }
  }
}