import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Evita que un estudiante o invitado con el registro incompleto (sin cédula,
// o sin carrera/ciclo en el caso de estudiantes) navegue por el resto del
// portal antes de llenar el formulario complementario.
export const perfilCompletoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const usuario = authService.user();

  if (['ESTUDIANTE', 'INVITADO'].includes(usuario?.rol ?? '') && !authService.perfilCompleto()) {
    router.navigate(['/completar-perfil']);
    return false;
  }

  return true;
};