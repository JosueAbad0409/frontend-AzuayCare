import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.user();

    if (!user) {
      router.navigate(['/login']);
      return false;
    }

    if (allowedRoles.includes(user.rol)) {
      return true;
    }

    // Redirección defensiva basada en jerarquía de acceso
    if (['ADMIN', 'COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'].includes(user.rol)) {
      router.navigate(['/admin/dashboard']);
    } else {
      router.navigate(['/estudiante/ficha']);
    }

    return false;
  };
};