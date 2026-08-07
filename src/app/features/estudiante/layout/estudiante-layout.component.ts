import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2'; 

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

  // Nombre reactivo (Se eliminaron propiedades sin uso como menuItems e iniciales)
  usuarioNombre = computed(() => {
    const user = this.authService.user();
    if (user?.nombre) {
      const partesNombre = user.nombre.split(' ');
      return partesNombre.length > 1 ? `${partesNombre[0]} ${partesNombre[1]}` : partesNombre[0];
    }
    return 'Cargando...';
  });

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