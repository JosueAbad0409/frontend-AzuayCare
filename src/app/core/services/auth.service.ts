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
}

export interface LoginGoogleResponse {
  message?: string;
  accessToken: string;
  usuario?: UsuarioLogueado;
  // Indica si al estudiante le falta llenar cédula, carrera o ciclo.
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

  // true si no hace falta mostrar el formulario de cédula/carrera/ciclo.
  // Por defecto true para no bloquear a coordinadores ni invitados.
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
      // Si nunca se guardó el valor, asumimos true para no romper sesiones antiguas.
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

  async loginWithBackend(googleIdToken: string): Promise<LoginGoogleResponse> {
    const res = await fetch(`${this.apiUrl}/login-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleIdToken }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Error autenticando con el servidor');
    }

    const data: LoginGoogleResponse = await res.json();
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }

    // El JWT decodificado no trae cedula/ciclo_id, así que completamos
    // el usuario en memoria con lo que vino en el cuerpo de la respuesta.
    if (data?.usuario) {
      this.user.update((actual) =>
        actual
          ? {
              ...actual,
              cedula: data.usuario!.cedula ?? null,
              ciclo_id: data.usuario!.ciclo_id ?? null,
              carrera_id: data.usuario!.carrera_id ?? actual.carrera_id ?? null,
            }
          : actual
      );
    }

    const completo = data?.perfilCompleto ?? true;
    this.perfilCompleto.set(completo);
    localStorage.setItem(PERFIL_COMPLETO_KEY, String(completo));

    return data;
  }

  // Se llama al terminar de guardar el pequeño formulario de registro
  // (cédula, carrera, ciclo) para que el resto de la app deje de bloquear
  // la navegación del estudiante.
  marcarPerfilCompleto(datos: { cedula: string; carrera_id?: string; ciclo_id?: string }): void {
    this.perfilCompleto.set(true);
    localStorage.setItem(PERFIL_COMPLETO_KEY, 'true');
    this.user.update((actual) => (actual ? { ...actual, ...datos } : actual));
  }
}