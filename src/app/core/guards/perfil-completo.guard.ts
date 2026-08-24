import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const perfilCompletoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const rol = auth.user()?.rol;

  if ((rol === 'ESTUDIANTE' || rol === 'INVITADO') && !auth.perfilCompleto()) {
    return router.createUrlTree(['/completar-perfil']);
  }
  return true;
};