import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'azuaycare_access_token';

// Interfaz estricta para el usuario logueado en AzuayCare
export interface UsuarioLogueado {
  id: string;
  email: string;
  nombre: string;
  rol: 'ESTUDIANTE' | 'INVITADO' | 'COORDINADOR_BIENESTAR' | 'COORDINADOR_CARRERA';
  carrera_id?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly token = signal<string | null>(null);
  readonly user = signal<UsuarioLogueado | null>(null);
  
  // Signal calculado para validar la sesión de forma instantánea
  readonly isLoggedIn = computed(() => !!this.token());

  private readonly apiUrl = 'https://azuaycare-backend.onrender.com/auth'; 

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
    this.token.set(token);
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
      this.decodeAndSetUser(token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      this.user.set(null);
    }
  }

  logout() {
    this.setToken(null);
  }

  private decodeAndSetUser(token: string) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        this.user.set(null);
        return;
      }
      
      const payload = parts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      
      const obj = JSON.parse(json);
      
      this.user.set({
        id: obj.sub,
        email: obj.email,
        nombre: obj.nombre || 'Usuario',
        rol: obj.rol,
        carrera_id: obj.carrera_id || null
      });
    } catch (error) {
      console.error('Error decodificando el token de sesión:', error);
      this.user.set(null);
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