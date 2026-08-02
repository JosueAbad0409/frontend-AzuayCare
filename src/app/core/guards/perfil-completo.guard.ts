import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Evita que un estudiante con el registro incompleto (sin cédula, carrera o
// ciclo) navegue por el resto del portal antes de llenar el pequeño
// formulario que aparece tras su primer inicio de sesión con Google.
export const perfilCompletoGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const usuario = authService.user();

    if (usuario?.rol === 'ESTUDIANTE' && !authService.perfilCompleto()) {
        router.navigate(['/completar-perfil']);
        return false;
    }

    return true;
};