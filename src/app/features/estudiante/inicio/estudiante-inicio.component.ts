import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FichaService } from '../../../core/services/ficha.service';
import { FichaRevision } from '../../../core/models/revision-ficha.model';


@Component({
  selector: 'app-estudiante-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl mx-auto space-y-8 animate-fade-in">

      <!-- HERO BANNER BIENVENIDA -->
      <div class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-500 to-teal-600 p-8 sm:p-12 text-white shadow-lg shadow-emerald-500/20">
        <div class="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[70px] pointer-events-none"></div>
        <div class="absolute -bottom-10 -left-10 w-56 h-56 bg-teal-800/20 rounded-full blur-[60px] pointer-events-none"></div>

        <div class="relative z-10 max-w-2xl space-y-5">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="px-4 py-1.5 rounded-full text-[10px] font-bold bg-white/15 text-white border border-white/25 uppercase tracking-widest backdrop-blur-sm">
              <i class="fas fa-university mr-1"></i> Instituto Superior Tecnológico Azuay
            </span>
            <span class="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  [ngClass]="esEstudiante() ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-400 text-amber-950'">
              <i class="fas" [ngClass]="esEstudiante() ? 'fa-user-graduate mr-1' : 'fa-user-clock mr-1'"></i>
              {{ esEstudiante() ? 'Estudiante Institucional' : 'Usuario Invitado' }}
            </span>
          </div>

          <h1 class="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Hola, <span class="text-white">{{ nombreUsuario() }}</span>
          </h1>
          <p class="text-emerald-50 text-sm sm:text-base leading-relaxed max-w-xl font-medium">
            Bienvenido al portal de Bienestar Estudiantil. Completa tu ficha socioeconómica para evaluar tus requerimientos de apoyo, acceder a becas y acompañamiento integral.
          </p>

          <div class="pt-4 flex gap-4">
            <a routerLink="/estudiante/ficha" class="px-6 py-3 bg-white text-emerald-700 rounded-xl font-black text-sm hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-lg">
              <i class="fas fa-play-circle"></i> Ir a mi Ficha
            </a>
          </div>
        </div>
      </div>

      <!-- ESTADO DE LA FICHA -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div class="col-span-1 md:col-span-2 bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
          <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i class="fas fa-chart-line text-emerald-500"></i> Estado Actual de tu Ficha
          </h3>

          @if (isLoading()) {
            <div class="animate-pulse flex gap-4 items-center">
              <div class="w-14 h-14 bg-slate-100 rounded-2xl"></div>
              <div class="space-y-3 flex-1">
                <div class="h-4 bg-slate-100 rounded w-1/3"></div>
                <div class="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            </div>
          } @else if (fichaActiva()) {
            <div class="flex items-center gap-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl group-hover:bg-slate-100/60 transition-colors">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                   [ngClass]="{
                     'bg-amber-100 text-amber-600': fichaActiva()?.estado_ficha === 'BORRADOR',
                     'bg-blue-100 text-blue-600': fichaActiva()?.estado_ficha === 'ENVIADA',
                     'bg-emerald-100 text-emerald-600': fichaActiva()?.estado_ficha === 'VALIDADO',
                     'bg-red-100 text-red-600': fichaActiva()?.estado_ficha === 'RECHAZADO'
                   }">
                <i class="fas" [ngClass]="{
                  'fa-edit': fichaActiva()?.estado_ficha === 'BORRADOR',
                  'fa-paper-plane': fichaActiva()?.estado_ficha === 'ENVIADA',
                  'fa-check-circle': fichaActiva()?.estado_ficha === 'VALIDADO',
                  'fa-times-circle': fichaActiva()?.estado_ficha === 'RECHAZADO'
                }"></i>
              </div>
              <div class="flex-1">
                <h4 class="text-slate-800 font-bold text-lg mb-1">{{ fichaActiva()?.estado_ficha }}</h4>
                <p class="text-xs text-slate-500">
                  @switch (fichaActiva()?.estado_ficha) {
                    @case ('BORRADOR') { Tienes un progreso guardado. Termina de llenarla y envíala. }
                    @case ('ENVIADA') { Tu ficha está en revisión por el departamento de Bienestar. }
                    @case ('VALIDADO') { ¡Felicidades! Tu ficha ha sido auditada y aprobada. }
                    @case ('RECHAZADO') { Existen inconsistencias. Revisa las observaciones. }
                  }
                </p>
              </div>
              <a routerLink="/estudiante/ficha" class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all">
                <i class="fas fa-chevron-right"></i>
              </a>
            </div>
          } @else {
            <div class="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
              <div class="w-14 h-14 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                <i class="fas fa-file-alt text-xl"></i>
              </div>
              <p class="text-sm font-semibold text-slate-700">No has iniciado tu ficha aún.</p>
              <a routerLink="/estudiante/ficha" class="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/30">
                Comenzar ahora <i class="fas fa-arrow-right"></i>
              </a>
            </div>
          }
        </div>

        <div class="col-span-1 bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-colors cursor-pointer" routerLink="/estudiante/documentos">
          <div>
            <div class="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl mb-6 group-hover:scale-105 transition-transform">
              <i class="fas fa-folder-open"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800 mb-2">Mis Documentos</h3>
            <p class="text-xs text-slate-500 leading-relaxed font-medium">
              Sube tu cédula, planillas de servicios básicos y comprobantes de ingresos de forma segura.
            </p>
          </div>
          <div class="mt-6 flex items-center justify-between text-xs font-bold text-indigo-600">
            <span>Gestionar Archivos</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class EstudianteInicioComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly fichaService = inject(FichaService);

  fichaActiva = signal<FichaRevision | null>(null);
  isLoading = signal<boolean>(true);

  nombreUsuario(): string {
    return this.authService.user()?.nombre?.split(' ')[0] || 'Estudiante';
  }

  esEstudiante(): boolean {
    return this.authService.user()?.rol === 'ESTUDIANTE';
  }

  ngOnInit(): void {
    this.fichaService.getMisFichas().subscribe({
      next: (fichas) => {
        if (fichas && fichas.length > 0) {
          // Buscamos la primera activa o la más reciente
          const activa = fichas.find(f => f.estado_ficha === 'BORRADOR' || f.estado_ficha === 'ENVIADA') || fichas[0];
          this.fichaActiva.set(activa);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }
}