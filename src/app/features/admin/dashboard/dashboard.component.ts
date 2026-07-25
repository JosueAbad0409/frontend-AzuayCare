import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CarreraService } from '../../../core/services/carrera/carrera.service';
import { FormularioService } from '../formulario/formulario.service';
import { PeriodoService } from '../../../core/services/periodo/periodo.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class Dashboard implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);

  totalCarreras = signal<number>(0);
  totalFormularios = signal<number>(0);
  periodoActivo = signal<PeriodoMatricula | null>(null);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.cargarResumen();
  }

  cargarResumen() {
    this.isLoading.set(true);

    this.carreraService.getCarreras().subscribe({
      next: (carreras) => this.totalCarreras.set(carreras.length),
      error: () => this.totalCarreras.set(0)
    });

    this.formularioService.getFormularios().subscribe({
      next: (forms) => this.totalFormularios.set(forms.length),
      error: () => this.totalFormularios.set(0)
    });

    this.periodoService.getPeriodos().subscribe({
      next: (periodos) => {
        const activo = periodos.find(p => p.activo);
        if (activo) {
          this.periodoActivo.set(activo);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al obtener periodos:', err);
        this.isLoading.set(false);
      }
    });
  }

  descargarReporteExcel() {
    const periodo = this.periodoActivo();
    if (!periodo) {
      alert('No se encontró un periodo de matrícula activo para generar el reporte Excel.');
      return;
    }
    window.open(`${environment.apiUrl}/reportes/socioeconomico/periodo/${periodo.id}`, '_blank');
  }
}