import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { perfilCompletoGuard } from './core/guards/perfil-completo.guard';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'login', 
    pathMatch: 'full' 
  },
  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'completar-perfil',
    loadComponent: () => import('./features/login/completar-perfil/completar-perfil').then(m => m.CompletarPerfilComponent),
    canActivate: [authGuard, roleGuard(['ESTUDIANTE', 'INVITADO'])]
  },
  { 
    path: 'admin',
    loadComponent: () => import('./features/admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard, roleGuard(['COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'])], 
    children: [
      { 
        path: '', 
        redirectTo: 'dashboard', 
        pathMatch: 'full' 
      },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      { 
        path: 'carreras', 
        loadComponent: () => import('./features/admin/carreras/carreras.component').then(m => m.CarrerasComponent)
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
        path: 'tipos-formulario',
        loadComponent: () => import('./features/admin/tipos-formulario/tipos-formulario.component').then(m => m.TiposFormularioComponent)
      },
      { 
        path: 'formularios/builder/:id', 
        loadComponent: () => import('./features/admin/formularios/builder/formulario-builder.component').then(m => m.FormularioBuilderComponent)
      },
      { 
        path: 'reportes', 
        loadComponent: () => import('./features/admin/reportes/reportes.component').then(m => m.ReportesComponent)
      },
      { 
        path: 'revision-fichas', 
        loadComponent: () => import('./features/admin/revision/revision.component').then(m => m.RevisionComponent)
      },
      {
        path: 'revision-fichas/:id',
        loadComponent: () => import('./features/admin/revision-detalle/revision-detalle').then(m => m.RevisionDetalleComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/admin/usuarios/usuarios.component').then(m => m.UsuariosComponent)
      },
      {
        path: 'prioridad-atencion',
        loadComponent: () => import('./features/admin/prioridad-atencion/prioridad-atencion').then(m => m.PrioridadAtencionComponent),
        canActivate: [roleGuard(['COORDINADOR_BIENESTAR'])]
      },
      {
        path: 'perfil',
        loadComponent: () => import('./shared/perfil/perfil.component').then(m => m.PerfilComponent)
      },
      {
        path: 'perfil-coordinador',
        redirectTo: 'perfil',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'estudiante',
    loadComponent: () => import('./features/estudiante/layout/estudiante-layout.component').then(m => m.EstudianteLayoutComponent),
    canActivate: [authGuard, roleGuard(['ESTUDIANTE', 'INVITADO']), perfilCompletoGuard],
    children: [
      { 
        path: '', 
        redirectTo: 'inicio', 
        pathMatch: 'full' 
      },
      {
        path: 'inicio',
        loadComponent: () => import('./features/estudiante/inicio/estudiante-inicio.component').then(m => m.EstudianteInicioComponent)
      },
      { 
        path: 'ficha', 
        loadComponent: () => import('./features/estudiante/estudiante-ficha.component').then(m => m.EstudianteFichaComponent)
      },
      {
        path: 'documentos',
        loadComponent: () => import('./features/estudiante/documentos/estudiante-documentos.component').then(m => m.EstudianteDocumentosComponent)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./shared/perfil/perfil.component').then(m => m.PerfilComponent)
      }
    ]
  },
  { 
    path: '**', 
    redirectTo: 'login' 
  }
];