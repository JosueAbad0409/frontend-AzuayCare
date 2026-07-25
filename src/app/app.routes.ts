import { Routes } from '@angular/router';
// 1. Corregida la importación (con minúscula)
import { authGuard } from './core/guards/auth.guard'; 
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' }, 

  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },

  { 
    path: 'admin',
    loadComponent: () => import('./features/admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    // 2. Corregido el uso del guard aquí:
    canActivate: [authGuard, roleGuard(['COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'])], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.Dashboard)
      },
      { 
        path: 'carreras', 
        loadComponent: () => import('./features/admin/carreras/carreras.component').then(m => m.Carreras)
      },
      { 
        path: 'ciclos', 
        loadComponent: () => import('./features/admin/ciclos/ciclos.component').then(m => m.CiclosComponent)
      },
      { 
        path: 'periodos', 
        loadComponent: () => import('./features/admin/periodos/periodos.component').then(m => m.PeriodosComponent)
      },
      { 
        path: 'formularios', 
        loadComponent: () => import('./features/admin/formularios/formularios.component').then(m => m.FormulariosComponent)
      },
      { 
        path: 'formularios/builder/:id', 
        loadComponent: () => import('./features/admin/formulario/builder/formulario-builder.component').then(m => m.FormularioBuilderComponent)
      },
      { 
        path: 'niveles', 
        loadComponent: () => import('./features/admin/niveles/niveles.component').then(m => m.NivelesComponent)
      },
      { 
        path: 'revision-fichas', 
        loadComponent: () => import('./features/admin/revision/revision.component').then(m => m.RevisionComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/admin/usuarios/usuarios.component').then(m => m.UsuariosComponent)
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./features/admin/auditoria/auditoria.component').then(m => m.AuditoriaComponent),
        canActivate: [roleGuard(['COORDINADOR_BIENESTAR'])] // Solo visible para bienestar
      },
      {
        path: 'perfil-coordinador',
        loadComponent: () => import('./features/admin/perfil-coordinador-form/perfil-coordinador-form.component').then(m => m.PerfilCoordinadorFormComponent)
      }
    ]
  },

  { 
    path: 'estudiante/ficha', 
    loadComponent: () => import('./features/estudiante/estudiante-ficha.component').then(m => m.EstudianteFichaComponent),
    // 3. Corregido el uso del guard aquí también:
    canActivate: [authGuard, roleGuard(['ESTUDIANTE', 'INVITADO'])]
  },

  { path: '**', redirectTo: 'login' }
];