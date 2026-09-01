import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';

const STORAGE_KEY = 'azuaycare_access_token';
const USER_KEY = 'azuaycare_user';
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
      this.token.set(cachedToken);

      const cachedUser = localStorage.getItem(USER_KEY);
      if (cachedUser) {
        try {
          this.user.set(JSON.parse(cachedUser));
        } catch {
          this.decodeAndSetUser(cachedToken);
        }
      } else {
        this.decodeAndSetUser(cachedToken);
      }

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
      this.logout();
    }
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERFIL_COMPLETO_KEY);
    this.token.set(null);
    this.user.set(null);
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

      const nuevoUsuario: UsuarioLogueado = {
        id: decoded.sub,
        email: decoded.email,
        nombre: decoded.nombre || 'Usuario',
        rol: decoded.rol,
        carrera_id: decoded.carrera_id || null,
        foto_url: this.user()?.foto_url || null
      };

      this.user.set(nuevoUsuario);
      this.guardarUsuarioEnStorage(nuevoUsuario);
    } catch {
      this.logout();
    }
  }

  private guardarUsuarioEnStorage(usuario: UsuarioLogueado | null): void {
    if (usuario) {
      localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    } else {
      localStorage.removeItem(USER_KEY);
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
      this.user.update((actual) => {
        const actualizado: UsuarioLogueado = {
          ...(actual || ({} as UsuarioLogueado)),
          id: data.usuario!.id || actual?.id || '',
          email: data.usuario!.email || actual?.email || '',
          nombre: data.usuario!.nombre || actual?.nombre || '',
          rol: data.usuario!.rol || actual?.rol || 'ESTUDIANTE',
          cedula: data.usuario!.cedula ?? actual?.cedula ?? null,
          ciclo_id: data.usuario!.ciclo_id ?? actual?.ciclo_id ?? null,
          carrera_id: data.usuario!.carrera_id ?? actual?.carrera_id ?? null,
          foto_url: (data.usuario as any).foto_url ?? actual?.foto_url ?? null,
        };
        this.guardarUsuarioEnStorage(actualizado);
        return actualizado;
      });
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
    this.user.update((actual) => {
      if (!actual) return null;
      const actualizado = { ...actual, ...datos };
      this.guardarUsuarioEnStorage(actualizado);
      return actualizado;
    });
  }

  actualizarFotoPerfil(fotoUrl: string): void {
    this.user.update((actual) => {
      if (!actual) return null;
      const actualizado = { ...actual, foto_url: fotoUrl };
      this.guardarUsuarioEnStorage(actualizado);
      return actualizado;
    });
  }
}