import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {path: '', redirectTo: 'login', pathMatch: 'full'},

  {path: 'login', 
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
    canActivate: [AuthGuard]
  },

  {path: 'admin',
    loadComponent: () => import('./features/admin/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [AuthGuard],
  },

  { path: '**', redirectTo: 'login' }

];