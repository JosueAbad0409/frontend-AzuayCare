import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CarreraService } from '../../../core/services/carrera/carrera.service';
import { Carrera } from '../../../core/models/carrera.model';

@Component({
  selector: 'app-carreras',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carreras.html',
  styleUrl: './carreras.css',
})
export class Carreras implements OnInit {

  private readonly carreraService = inject(CarreraService);

  carreras = signal <Carrera[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string>('');

  ngOnInit(): void {
    this.cargarCarreras();
  }

  cargarCarreras() {
    this.isLoading.set(true);
    this.carreraService.getCarreras().subscribe({
      next: (data) => {
        this.carreras.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar las carreras.');
        this.isLoading.set(false);
        console.error('Error al cargar las carreras:', err);
      }
    });
  }
}

