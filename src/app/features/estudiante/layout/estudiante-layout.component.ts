import { Component, signal, inject, OnInit, ChangeDetectionStrategy, computed } from '@angular/core';
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
    <!-- Contenedor principal con fondo claro -->
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-500/30 relative flex flex-col md:flex-row">
      
      <!-- Barra de Navegación Flotante Clara -->
      <nav class="fixed top-0 w-full z-50 px-4 py-3 transition-all duration-300">
        <div class="max-w-6xl mx-auto bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
          
          <!-- SECCIÓN IZQUIERDA: Nombre del Usuario -->
          <div class="flex items-center gap-3 cursor-pointer group" routerLink="/estudiante/inicio">
            <!-- Círculo con Iniciales -->
            <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center font-black text-blue-700 shadow-sm group-hover:scale-105 transition-transform">
              {{ iniciales() }}
            </div>
            <div class="hidden sm:block">
              <!-- Nombre del usuario logueado -->
              <h1 class="text-sm font-extrabold text-slate-800 tracking-wide leading-tight">
                {{ usuarioNombre() }}
              </h1>
              <!-- Subtítulo -->
              <p class="text-[10px] text-blue-600 font-bold tracking-widest uppercase">
                AzuayCare • {{ authService.user()?.rol || 'ESTUDIANTE' }}
              </p>
            </div>
          </div>

          <!-- SECCIÓN CENTRAL: Rutas Principales -->
          <div class="flex items-center gap-1 sm:gap-2">
            <a *ngFor="let item of menuItems"
              [routerLink]="item.route" 
              routerLinkActive="bg-blue-50 text-blue-700 font-bold border-blue-100" 
              class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all border border-transparent flex items-center gap-2">
              <span>{{ item.icon }}</span>
              <span class="hidden md:inline">{{ item.label }}</span>
            </a>
          </div>

          <!-- SECCIÓN DERECHA: Botón de Salir -->
          <div class="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-4">
            <button (click)="logout()" class="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2 border border-rose-100 text-xs font-bold shadow-sm cursor-pointer" title="Cerrar Sesión">
              <span class="hidden sm:inline">Salir</span>
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>

        </div>
      </nav>

      <!-- Áreas de Contenido (Aquí se renderiza estudiante-ficha.component) -->
      <main class="relative z-10 pt-28 pb-12 px-4 w-full flex-1 max-w-6xl mx-auto">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class EstudianteLayoutComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  isSidebarCollapsed = signal<boolean>(false);

  // Usamos 'computed' para que el nombre se actualice reactivamente apenas lleguen los datos
  usuarioNombre = computed(() => {
    const user = this.authService.user();
    if (user?.nombre) {
      const partesNombre = user.nombre.split(' ');
      return partesNombre.length > 1 ? `${partesNombre[0]} ${partesNombre[1]}` : partesNombre[0];
    }
    return 'Cargando...';
  });

// Iniciales exactas usando primer nombre y primer apellido
  iniciales = computed(() => {
    const user: any = this.authService.user();
    if (user) {
      const pNombre = user.primer_nombre || user.nombre?.split(' ')[0] || '';
      const pApellido = user.primer_apellido || user.nombre?.split(' ')[1] || '';
      
      const inicial1 = pNombre.charAt(0) || '';
      const inicial2 = pApellido.charAt(0) || '';
      
      return (inicial1 + inicial2).toUpperCase() || 'US';
    }
    return 'US';
  });

  menuItems: MenuItem[] = [
    { label: 'Inicio', icon: '🏠', route: '/estudiante/inicio' },
    { label: 'Mi Ficha', icon: '📝', route: '/estudiante/ficha' },
    { label: 'Documentos', icon: '📁', route: '/estudiante/documentos' }
  ];

  toggleSidebar() {
    this.isSidebarCollapsed.update(val => !val);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}