login.component ts


import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);
  private retryTimeoutId?: ReturnType<typeof setTimeout>;

  isLoading = signal(false);
  error = signal('');
  successMessage = signal('');
  isServerWarming = signal(false);
  
  // Controla qué formulario se muestra
  authMode = signal<'login' | 'register'>('login');
  
  // Control de visibilidad de contraseña
  showLoginPassword = signal(false);
  showRegisterPassword = signal(false);

  // Signals para controlar la visibilidad de modales
  showQrModal = signal(false);
  showHelpModal = signal(false);
  showGuideModal = signal(false);
  guideStep = signal(0);

  // Pasos de la guía interactiva
  guideSteps = [
    {
      title: '¿Tienes correo de Gmail o del Tec Azuay?',
      text: 'Si tu correo termina en @gmail.com o es tu correo institucional @tecazuay.edu.ec, usa el botón "Continuar con Google" al final del formulario. Es más rápido y no necesitas crear una contraseña nueva.'
    },
    {
      title: '¿Tienes otro tipo de correo?',
      text: 'Si usas un correo distinto (Outlook, Hotmail, Yahoo, u otro que no sea de Google), regístrate con la pestaña "Crear Cuenta" usando ese correo y una contraseña. Luego inicia sesión normalmente con "Iniciar Sesión".'
    },
    {
      title: '¿Ya tienes cuenta creada?',
      text: 'Si ya te registraste antes con correo y contraseña, no necesitas volver a crear cuenta: solo ve a la pestaña "Iniciar Sesión" e ingresa tus datos.'
    },
    {
      title: '¿Prefieres usar la app móvil?',
      text: 'También puedes acceder desde tu celular. Al final de esta página encontrarás el botón "Descarga la app móvil aquí", donde podrás escanear el código QR o descargar la APK directamente.'
    }
  ];

  // Formularios con validaciones estrictas
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  registerForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadGoogleScript();
    }
    this.isServerWarming.set(true);
    this.auth.warmUpBackend().finally(() => this.isServerWarming.set(false));
  }

  ngOnDestroy(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  // ==========================================
  // LÓGICA LOCAL (CORREO / CONTRASEÑA)
  // ==========================================

  toggleMode(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.error.set('');
    this.successMessage.set('');
    this.loginForm.reset();
    this.registerForm.reset();
  }

  openGuideModal(): void {
    this.guideStep.set(0);
    this.showGuideModal.set(true);
  }

  nextGuideStep(): void {
    if (this.guideStep() < this.guideSteps.length - 1) {
      this.guideStep.update(s => s + 1);
    }
  }

  prevGuideStep(): void {
    if (this.guideStep() > 0) {
      this.guideStep.update(s => s - 1);
    }
  }

  async onSubmitLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    try {
      await this.auth.loginLocal(this.loginForm.value);
      await this.navigateBasedOnRole();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Error al iniciar sesión.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSubmitRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    try {
      const res = await this.auth.registroLocal(this.registerForm.value);
      this.successMessage.set(res.message || 'Registro exitoso. Ahora inicia sesión.');
      this.toggleMode('login');
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Error al registrar la cuenta.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ==========================================
  // LÓGICA GOOGLE
  // ==========================================

  private loadGoogleScript(): void {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      this.initGsi();
      return;
    }

    const existingScript = document.getElementById('gsi-client-script');
    if (existingScript) {
      this.waitForGoogleReady();
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.initGsi();
    script.onerror = () => this.error.set('No se pudo establecer conexión con los servidores de Google.');
    document.head.appendChild(script);
  }

  private waitForGoogleReady(retries = 20): void {
    if ((window as any).google?.accounts?.id) {
      this.initGsi();
      return;
    }
    if (retries <= 0) {
      this.error.set('No se pudo inicializar el acceso con Google. Recarga la página.');
      return;
    }
    this.retryTimeoutId = setTimeout(() => this.waitForGoogleReady(retries - 1), 250);
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
      await this.navigateBasedOnRole();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Servicio temporalmente inactivo.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Redirección unificada para Google y Local
  private async navigateBasedOnRole() {
    const rol = this.auth.user()?.rol;
    if ((rol === 'ESTUDIANTE' || rol === 'INVITADO') && !this.auth.perfilCompleto()) {
      await this.router.navigate(['/completar-perfil']);
    } else if (rol === 'ESTUDIANTE' || rol === 'INVITADO') {
      await this.router.navigate(['/estudiante/inicio']);
    } else {
      await this.router.navigate(['/admin/dashboard']);
    }
  }
}