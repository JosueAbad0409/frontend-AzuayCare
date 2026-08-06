import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PrioridadAtencionService } from '../../../core/services/prioridad-atencion.service';
import { FichaRevision } from '../../../core/models/revision-ficha.model';

@Component({
  selector: 'app-prioridad-atencion',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './prioridad-atencion.html'
})
export class PrioridadAtencionComponent implements OnInit {
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly router = inject(Router);

  fichas = signal<FichaRevision[]>([]);
  isLoading = signal<boolean>(true);
  
  paginaActual = signal<number>(1);
  totalRegistros = signal<number>(0);
  take = 50;

  nivelFiltro = signal<string>('TODOS');
  nivelesPosibles = ['TODOS', 'Alto', 'Medio', 'Bajo']; 

  ngOnInit(): void {
    this.cargarFichas();
  }

  cargarFichas(): void {
    this.isLoading.set(true);
    const skip = (this.paginaActual() - 1) * this.take;

    this.prioridadService.getFichasPorPrioridad(skip, this.take, this.nivelFiltro()).subscribe({
      next: (res) => {
        this.fichas.set(res.data);
        this.totalRegistros.set(res.total);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar prioridad', err);
        this.isLoading.set(false);
      }
    });
  }

  cambiarNivel(nivel: string): void {
    this.nivelFiltro.set(nivel);
    this.paginaActual.set(1);
    this.cargarFichas();
  }

  cambiarPagina(nuevaPagina: number): void {
    this.paginaActual.set(nuevaPagina);
    this.cargarFichas();
  }

  get totalPaginas(): number {
    return Math.ceil(this.totalRegistros() / this.take) || 1;
  }

  verFicha(fichaId: string): void {
    this.router.navigate(['/admin/revision-fichas'], { queryParams: { search: fichaId }});
  }
}