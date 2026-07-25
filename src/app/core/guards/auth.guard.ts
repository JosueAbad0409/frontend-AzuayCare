import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const expectedRoles = route.data['roles'] as Array<string>;
  const userRole = authService.getUserRole();

  if (expectedRoles && expectedRoles.length > 0) {
    if (!userRole || !expectedRoles.includes(userRole)) {
      // Redirección defensiva con verificación segura de nulos
      if (userRole && ['ADMIN', 'COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'].includes(userRole)) {
        router.navigate(['/admin/dashboard']);
      } else {
        router.navigate(['/estudiante/ficha']);
      }
      return false;
    }
  }

  return true;
};