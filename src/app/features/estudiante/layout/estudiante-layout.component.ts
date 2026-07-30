import { Component, signal, inject, OnInit } from '@angular/core';
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
  template: `
    <div class="layout-container" [class.collapsed]="isSidebarCollapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo-box">
            <span class="logo-icon">🎓</span>
            <span class="logo-text" *ngIf="!isSidebarCollapsed()">AzuayCare</span>
          </div>
          <button class="toggle-btn" (click)="toggleSidebar()" type="button" [attr.aria-label]="isSidebarCollapsed() ? 'Expandir menú' : 'Colapsar menú'">
            {{ isSidebarCollapsed() ? '❯' : '❮' }}
          </button>
        </div>

        <nav class="sidebar-nav">
          <ul>
            <li *ngFor="let item of menuItems">
              <a 
                [routerLink]="item.route" 
                routerLinkActive="active" 
                class="nav-item"
                [title]="isSidebarCollapsed() ? item.label : ''">
                <span class="nav-icon">{{ item.icon }}</span>
                <span class="nav-label" *ngIf="!isSidebarCollapsed()">{{ item.label }}</span>
              </a>
            </li>
          </ul>
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" (click)="logout()" type="button" [title]="isSidebarCollapsed() ? 'Cerrar Sesión' : ''">
            <span class="nav-icon">🚪</span>
            <span class="nav-label" *ngIf="!isSidebarCollapsed()">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <header class="top-header">
          <h1 class="header-title">Portal Estudiantil</h1>
          <div class="user-badge">
            <span class="avatar">👤</span>
            <span class="username">{{ usuarioNombre() }}</span>
          </div>
        </header>

        <div class="content-body">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .layout-container {
      display: flex;
      min-height: 100vh;
      background-color: #0b0f19;
      color: #e2e8f0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .sidebar {
      width: 260px;
      background: #111827;
      border-right: 1px solid #1f2937;
      display: flex;
      flex-direction: column;
      transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 100;
    }

    .layout-container.collapsed .sidebar {
      width: 80px;
    }

    .sidebar-header {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid #1f2937;
    }

    .logo-box {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: bold;
      font-size: 1.2rem;
      color: #10b981;
    }

    .logo-icon {
      font-size: 1.5rem;
    }

    .toggle-btn {
      background: transparent;
      border: 1px solid #374151;
      color: #9ca3af;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-btn:hover {
      color: #fff;
      border-color: #6b7280;
    }

    .sidebar-nav {
      flex: 1;
      padding: 16px 8px;
    }

    .sidebar-nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      color: #9ca3af;
      text-decoration: none;
      transition: all 0.2s;
    }

    .nav-item:hover, .nav-item.active {
      background: #1f2937;
      color: #10b981;
    }

    .nav-icon {
      font-size: 1.2rem;
      min-width: 24px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 16px 8px;
      border-top: 1px solid #1f2937;
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border: none;
      background: transparent;
      color: #ef4444;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: background 0.2s;
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    .top-header {
      height: 64px;
      background: #111827;
      border-bottom: 1px solid #1f2937;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }

    .header-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .user-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1f2937;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.9rem;
    }

    .content-body {
      padding: 24px;
      flex: 1;
    }
  `]
})
export class EstudianteLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  isSidebarCollapsed = signal<boolean>(false);
  // Eliminado el texto estático inicial
  usuarioNombre = signal<string>('Cargando...'); 

  menuItems: MenuItem[] = [
    { label: 'Inicio', icon: '🏠', route: '/estudiante/inicio' },
    { label: 'Ficha Socioeconómica', icon: '📝', route: '/estudiante/ficha' },
    { label: 'Mis Documentos', icon: '📁', route: '/estudiante/documentos' }
  ];

  ngOnInit(): void {
    const user = this.authService.user();
    if (user?.nombre) {
      this.usuarioNombre.set(user.nombre);
    } else {
      this.usuarioNombre.set('Invitado');
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