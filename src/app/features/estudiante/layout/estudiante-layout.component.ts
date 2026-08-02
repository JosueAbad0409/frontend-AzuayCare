import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-estudiante-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#090a0f] text-slate-200 font-sans selection:bg-emerald-500/30 relative flex flex-col md:flex-row">
      <!-- Ambient Glow (Luces de Fondo) -->
      <div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-emerald-500/10 blur-[120px] pointer-events-none z-0"></div>
      <div class="fixed bottom-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[150px] pointer-events-none z-0"></div>

      <!-- Barra de Navegación Flotante -->
      <nav class="fixed top-0 w-full z-50 px-4 py-3 transition-all duration-300">
        <div class="max-w-6xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl px-5 py-3 flex items-center justify-between shadow-2xl shadow-black/60">
          
          <!-- Marca / Logo -->
          <div class="flex items-center gap-3 cursor-pointer group" routerLink="/estudiante/inicio">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
              AC
            </div>
            <div class="hidden sm:block">
              <h1 class="text-sm font-extrabold text-white tracking-wide leading-tight">AzuayCare</h1>
              <p class="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase">Portal Estudiantil</p>
            </div>
          </div>

          <!-- Rutas Principales -->
          <div class="flex items-center gap-1 sm:gap-2">
            <a *ngFor="let item of menuItems"
              [routerLink]="item.route" 
              routerLinkActive="bg-white/10 text-white border-white/20" 
              class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-transparent flex items-center gap-2">
              <span>{{ item.icon }}</span>
              <span class="hidden md:inline">{{ item.label }}</span>
            </a>
          </div>

          <!-- Usuario y Salida -->
          <div class="flex items-center gap-3 border-l border-slate-700/60 pl-3 sm:pl-4">
            <div class="flex flex-col items-end hidden lg:flex">
              <span class="text-xs font-bold text-white">{{ usuarioNombre() }}</span>
              <span class="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">{{ authService.user()?.rol || 'ESTUDIANTE' }}</span>
            </div>
            <button (click)="logout()" class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-500/20 group cursor-pointer" title="Cerrar Sesión">
              <i class="fas fa-sign-out-alt group-hover:scale-110 transition-transform"></i>
            </button>
          </div>

        </div>
      </nav>

      <!-- Áreas de Contenido -->
      <main class="relative z-10 pt-28 pb-12 px-4 w-full flex-1 max-w-6xl mx-auto">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class EstudianteLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  isSidebarCollapsed = signal<boolean>(false);
  usuarioNombre = signal<string>('Cargando...');

  menuItems: MenuItem[] = [
    { label: 'Inicio', icon: '🏠', route: '/estudiante/inicio' },
    { label: 'Mi Ficha', icon: '📝', route: '/estudiante/ficha' },
    { label: 'Documentos', icon: '📁', route: '/estudiante/documentos' }
  ];

  ngOnInit(): void {
    const user = this.authService.user();
    if (user?.nombre) {
      this.usuarioNombre.set(user.nombre.split(' ')[0]); // Solo el primer nombre
    } else {
      this.usuarioNombre.set('Estudiante');
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed.update(val => !val);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}