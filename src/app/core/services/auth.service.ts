import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';

const STORAGE_KEY = 'azuaycare_access_token';
const PERFIL_COMPLETO_KEY = 'azuaycare_perfil_completo';

export interface UsuarioLogueado {
  id: string;
  email: string;
  nombre: string;
  rol: 'ESTUDIANTE' | 'INVITADO' | 'COORDINADOR_BIENESTAR' | 'COORDINADOR_CARRERA';
  carrera_id?: string | null;
  cedula?: string | null;
  ciclo_id?: string | null;
  foto_url?: string | null;
}

// Renombramos la interfaz porque ahora sirve tanto para Google como para Login Local
export interface AuthResponse {
  message?: string;
  accessToken: string;
  usuario?: UsuarioLogueado;
  perfilCompleto?: boolean;
}

interface JwtPayloadCustom {
  sub: string;
  email: string;
  nombre?: string;
  rol: 'ESTUDIANTE' | 'INVITADO' | 'COORDINADOR_BIENESTAR' | 'COORDINADOR_CARRERA';
  carrera_id?: string | null;
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly token = signal<string | null>(null);
  readonly user = signal<UsuarioLogueado | null>(null);
  readonly perfilCompleto = signal<boolean>(true);
  readonly isLoggedIn = computed(() => !!this.token());

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const cachedToken = localStorage.getItem(STORAGE_KEY);
    if (cachedToken) {
      this.setToken(cachedToken);
      const cachedPerfilCompleto = localStorage.getItem(PERFIL_COMPLETO_KEY);
      this.perfilCompleto.set(cachedPerfilCompleto !== 'false');
    }
  }

  setToken(token: string | null): void {
    if (token) {
      if (this.isTokenExpired(token)) {
        this.logout();
        return;
      }
      localStorage.setItem(STORAGE_KEY, token);
      this.token.set(token);
      this.decodeAndSetUser(token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      this.token.set(null);
      this.user.set(null);
    }
  }

  logout(): void {
    this.setToken(null);
    localStorage.removeItem(PERFIL_COMPLETO_KEY);
    this.perfilCompleto.set(true);
  }

  getUserRole(): string | null {
    return this.user()?.rol || null;
  }

  getUsuario(): UsuarioLogueado | null {
    return this.user();
  }

  private isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayloadCustom>(token);
      if (!decoded.exp) return false;
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  }

  private decodeAndSetUser(token: string): void {
    try {
      const decoded = jwtDecode<JwtPayloadCustom>(token);

      this.user.set({
        id: decoded.sub,
        email: decoded.email,
        nombre: decoded.nombre || 'Usuario',
        rol: decoded.rol,
        carrera_id: decoded.carrera_id || null
      });
    } catch {
      this.logout();
    }
  }

  // ==========================================
  // FLUJO GOOGLE
  // ==========================================
  async loginWithBackend(googleIdToken: string): Promise<AuthResponse> {
    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/login-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleIdToken }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor está tardando más de lo normal en responder. Intenta nuevamente en unos segundos.');
      }
      throw new Error('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      await this.manejarErrorFetch(res, 'Error autenticando con el servidor');
    }

    const data: AuthResponse = await res.json();
    this.procesarRespuestaLogin(data);
    return data;
  }

  // ==========================================
  // FLUJOS LOCALES (CORREO Y CONTRASEÑA)
  // ==========================================
  async registroLocal(datos: any): Promise<{ message: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder.');
      throw new Error('No se pudo conectar con el servidor.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      await this.manejarErrorFetch(res, 'Error al registrar la cuenta');
    }

    return await res.json();
  }

  async loginLocal(credenciales: any): Promise<AuthResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciales),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder.');
      throw new Error('No se pudo conectar con el servidor.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      await this.manejarErrorFetch(res, 'Error al iniciar sesión');
    }

    const data: AuthResponse = await res.json();
    this.procesarRespuestaLogin(data);
    return data;
  }

  // ==========================================
  // HELPERS INTERNOS
  // ==========================================
  private async manejarErrorFetch(res: Response, mensajePorDefecto: string): Promise<never> {
    let mensajeError = mensajePorDefecto;
    try {
      const errorJson = await res.json();
      mensajeError = errorJson.message || errorJson.error || mensajeError;
      if (Array.isArray(mensajeError)) mensajeError = mensajeError.join(', ');
    } catch {
      mensajeError = await res.text();
    }
    throw new Error(mensajeError);
  }

  private procesarRespuestaLogin(data: AuthResponse): void {
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }

    if (data?.usuario) {
      this.user.update((actual) =>
        actual
          ? {
              ...actual,
              cedula: data.usuario!.cedula ?? null,
              ciclo_id: data.usuario!.ciclo_id ?? null,
              carrera_id: data.usuario!.carrera_id ?? actual.carrera_id ?? null,
              foto_url: (data.usuario as any).foto_url ?? null,
            }
          : actual
      );
    }

    const completo = data?.perfilCompleto ?? true;
    this.perfilCompleto.set(completo);
    localStorage.setItem(PERFIL_COMPLETO_KEY, String(completo));
  }

  async warmUpBackend(): Promise<void> {
    try {
      await fetch(`${environment.apiUrl}/health`, { method: 'GET' });
    } catch {}
  }

  marcarPerfilCompleto(datos: { cedula: string; carrera_id?: string; ciclo_id?: string }): void {
    this.perfilCompleto.set(true);
    localStorage.setItem(PERFIL_COMPLETO_KEY, 'true');
    this.user.update((actual) => (actual ? { ...actual, ...datos } : actual));
  }

  actualizarFotoPerfil(fotoUrl: string): void {
    this.user.update((actual) => (actual ? { ...actual, foto_url: fotoUrl } : actual));
  }
}