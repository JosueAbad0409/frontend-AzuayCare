import { Component, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2'; 

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
  templateUrl: './estudiante-layout.component.html',
  styleUrl: './estudiante-layout.component.css'
})
export class EstudianteLayoutComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  isSidebarCollapsed = signal<boolean>(false);

  // Nombre reactivo
  usuarioNombre = computed(() => {
    const user = this.authService.user();
    if (user?.nombre) {
      const partesNombre = user.nombre.split(' ');
      return partesNombre.length > 1 ? `${partesNombre[0]} ${partesNombre[1]}` : partesNombre[0];
    }
    return 'Cargando...';
  });

  // Iniciales exactas
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

  // Menú unificado con FontAwesome para el header superior
  menuItems: MenuItem[] = [
    { label: 'Inicio', icon: 'fas fa-home text-amber-500', route: '/estudiante/inicio' },
    { label: 'Mi Ficha', icon: 'fas fa-file-signature text-purple-500', route: '/estudiante/ficha' },
    { label: 'Documentos', icon: 'fas fa-folder text-amber-500', route: '/estudiante/documentos' },
    { label: 'Mi Perfil', icon: 'fas fa-id-card text-emerald-500', route: '/estudiante/perfil' }
  ];

  toggleSidebar() {
    this.isSidebarCollapsed.update(val => !val);
  }

  logout() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Tendrás que volver a ingresar tus credenciales para continuar.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#e11d48',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-xl',
        cancelButton: 'rounded-xl'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }
}