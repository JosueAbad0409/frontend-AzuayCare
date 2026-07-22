import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Inyectamos tu servicio de autenticación para leer el token
    const authService = inject(AuthService);
    const token = authService.token();

    // Si existe un token, clonamos la petición y le agregamos la cabecera de Autorización
    if (token) {
        const clonedReq = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(clonedReq); // Mandamos la petición modificada
    }

    // Si no hay token (ej. en el login), mandamos la petición tal como está
    return next(req);
};