import { Component, inject, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EstudianteAyudaModalComponent } from '../components/estudiante-ayuda-modal.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-estudiante-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, EstudianteAyudaModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estudiante-layout.component.html',
  styleUrl: './estudiante-layout.component.css'
})
export class EstudianteLayoutComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly mostrarAyuda = signal(false);

  usuarioNombre = computed(() => {
    const user = this.authService.user();
    if (user?.nombre) {
      const partesNombre = user.nombre.split(' ');
      return partesNombre.length > 1 ? `${partesNombre[0]} ${partesNombre[1]}` : partesNombre[0];
    }
    return 'Cargando...';
  });

  abrirAyuda(): void {
    this.mostrarAyuda.set(true);
  }

  cerrarAyuda(): void {
    this.mostrarAyuda.set(false);
  }

  logout() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Tendrás que volver a ingresar tus credenciales para continuar.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }
}