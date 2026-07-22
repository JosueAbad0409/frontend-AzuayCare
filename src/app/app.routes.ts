import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // EL LOGIN NO LLEVA AUTHGUARD (Debe ser público)
  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },

  // EL ADMIN SÍ LLEVA AUTHGUARD (Está protegido)
  { 
    path: 'admin',
    loadComponent: () => import('./features/admin/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [AuthGuard]
  },

  // COMODÍN PARA RUTAS NO ENCONTRADAS
  { path: '**', redirectTo: 'login' }
];