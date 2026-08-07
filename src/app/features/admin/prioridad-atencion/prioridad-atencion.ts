import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PrioridadAtencionService, ReporteNeeSalud } from '../../../core/services/prioridad-atencion.service';
import { PeriodoService } from '../../../core/services/periodo.service'; 

@Component({
  selector: 'app-prioridad-atencion',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './prioridad-atencion.html'
})
export class PrioridadAtencionComponent implements OnInit {
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly periodoService = inject(PeriodoService);
  private readonly router = inject(Router);

  reporteNee = signal<ReporteNeeSalud[]>([]);
  isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarReporteEspecializado();
  }

  cargarReporteEspecializado(): void {
    this.isLoading.set(true);
    
    this.periodoService.getPeriodos().subscribe({
      next: (periodos) => {
        const periodoActivo = periodos.find(p => p.activo);
        if (periodoActivo) {
          this.prioridadService.getReporteNee(periodoActivo.id).subscribe({
            next: (data) => {
              this.reporteNee.set(data);
              this.isLoading.set(false);
            },
            error: (err) => {
              console.error('Error al cargar reporte NEE', err);
              this.isLoading.set(false);
            }
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  // 🔥 FUNCIÓN AUXILIAR PARA ITERAR EL JSON DINÁMICO EN EL HTML
  obtenerLlavesVulnerabilidad(detalles: Record<string, any>): string[] {
    return detalles ? Object.keys(detalles) : [];
  }

  verFicha(fichaId: string): void {
  if (!fichaId) {
    console.warn('No se recibió ficha_id');
    return;
  }
  this.router.navigate(['/admin/revision-fichas', fichaId]);
}

  exportarReporte(): void {
    console.log('Exportando reporte...');
  }
}