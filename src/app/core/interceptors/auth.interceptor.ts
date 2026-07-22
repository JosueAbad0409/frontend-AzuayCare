import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Buscamos el token guardado en el Paso 2
    const token = localStorage.getItem('token');

    // Si hay token, clonamos la petición y le pegamos el token
    if (token) {
        const authReq = req.clone({
        setHeaders: {
            Authorization: `Bearer ${token}`
        }
        });
        return next(authReq);
    }

    // Si no hay token, la petición se va normal
    return next(req);
};