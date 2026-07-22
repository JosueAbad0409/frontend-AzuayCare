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
    canActivate: [AuthGuard],
    // Fíjate que aquí usamos un "Layout" principal si tuviéramos uno, pero como tu Dashboard 
    // es tu vista principal, lo dejaremos como la raíz del admin.
    children: [
      { 
        path: '', // La ruta por defecto (/admin)
        loadComponent: () => import('./features/admin//dashboard/dashboard').then(m => m.Dashboard)
      },
      { 
        path: 'carreras', // La nueva ruta (/admin/carreras)
        loadComponent: () => import('./features/admin/carreras/carreras').then(m => m.Carreras)
      }
    ]
  },

  // COMODÍN PARA RUTAS NO ENCONTRADAS
  { path: '**', redirectTo: 'login' }
];