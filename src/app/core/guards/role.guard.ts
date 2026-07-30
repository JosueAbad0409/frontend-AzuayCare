// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\core\guards\role.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.user();

    // Si no hay usuario autenticado, redirigir al login
    if (!user) {
      router.navigate(['/login']);
      return false;
    }

    // Verificar si el rol del usuario está dentro de los roles autorizados para la ruta
    if (allowedRoles.includes(user.rol)) {
      return true;
    }

    // Redirección inteligente basada únicamente en los roles oficiales del sistema
    if (['COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'].includes(user.rol)) {
      router.navigate(['/admin/dashboard']);
    } else {
      router.navigate(['/estudiante/inicio']);
    }

    return false;
  };
};