import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // LOGIN (Público)
  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },

  // ADMIN (Protegido por AuthGuard)
  { 
    path: 'admin',
    canActivate: [AuthGuard],
    children: [
      { 
        path: '', 
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.Dashboard)
      },
      { 
        path: 'carreras', 
        loadComponent: () => import('./features/admin/carreras/carreras.component').then(m => m.Carreras)
      }
    ]
  },

  // COMODÍN (Cualquier ruta no encontrada redirige a Login)
  { path: '**', redirectTo: 'login' }
];