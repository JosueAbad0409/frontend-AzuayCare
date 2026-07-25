import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';

const STORAGE_KEY = 'azuaycare_access_token';

export interface UsuarioLogueado {
  id: string;
  email: string;
  nombre: string;
  rol: 'ESTUDIANTE' | 'INVITADO' | 'COORDINADOR_BIENESTAR' | 'COORDINADOR_CARRERA';
  carrera_id?: string | null;
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
  
  readonly isLoggedIn = computed(() => !!this.token());

  private readonly apiUrl = `${environment.apiUrl}/auth`; 

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const cachedToken = localStorage.getItem(STORAGE_KEY);
    if (cachedToken) {
      this.setToken(cachedToken);
    }
  }

  setToken(token: string | null) {
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

  logout() {
    this.setToken(null);
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

  private decodeAndSetUser(token: string) {
    try {
      const decoded = jwtDecode<JwtPayloadCustom>(token);
      
      this.user.set({
        id: decoded.sub,
        email: decoded.email,
        nombre: decoded.nombre || 'Usuario',
        rol: decoded.rol,
        carrera_id: decoded.carrera_id || null
      });
    } catch (error) {
      console.error('Error decodificando el token con jwt-decode:', error);
      this.logout();
    }
  }

  async loginWithBackend(googleIdToken: string): Promise<any> {
    const res = await fetch(`${this.apiUrl}/login-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleIdToken }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Error autenticando con el servidor');
    }

    const data = await res.json();
    if (data?.accessToken) {
      this.setToken(data.accessToken);
    }
    return data;
  }
}