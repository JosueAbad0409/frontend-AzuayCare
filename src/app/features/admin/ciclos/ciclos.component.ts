import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CiclosService } from '../../../core/services/ciclos.service';
import { CarreraService } from '../../../core/services/carrera/carrera.service';
import { Ciclo } from '../../../core/models/ciclo.model';
import { Carrera } from '../../../core/models/carrera.model';

@Component({
  selector: 'app-ciclos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ciclos.component.html',
  styleUrls: ['./ciclos.component.css']
})
export class CiclosComponent implements OnInit {
  private readonly ciclosService = inject(CiclosService);
  private readonly carreraService = inject(CarreraService);
  private readonly fb = inject(FormBuilder);

  ciclos = signal<Ciclo[]>([]);
  carreras = signal<Carrera[]>([]);
  loading = signal<boolean>(false);
  modalOpen = signal<boolean>(false);
  editingCicloId = signal<string | null>(null);

  cicloForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    carreraId: ['', [Validators.required]],
    activo: [true]
  });

  ngOnInit(): void {
    this.cargarCarreras();
    this.cargarCiclos();
  }

  cargarCarreras(): void {
    this.carreraService.getCarreras().subscribe({
      next: (data) => this.carreras.set(data),
      error: (err) => console.error('Error al cargar carreras:', err)
    });
  }

  cargarCiclos(): void {
    this.loading.set(true);
    this.ciclosService.getCiclos().subscribe({
      next: (data) => {
        this.ciclos.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar ciclos:', err);
        this.loading.set(false);
      }
    });
  }

  openModal(ciclo?: Ciclo): void {
    this.modalOpen.set(true);
    if (ciclo && ciclo.id) {
      this.editingCicloId.set(ciclo.id);
      this.cicloForm.patchValue({
        nombre: ciclo.nombre,
        carreraId: ciclo.carreraId,
        activo: ciclo.activo
      });
    } else {
      this.editingCicloId.set(null);
      this.cicloForm.reset({ activo: true, carreraId: '' });
    }
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.cicloForm.reset();
  }

  guardarCiclo(): void {
    if (this.cicloForm.invalid) {
      this.cicloForm.markAllAsTouched();
      return;
    }

    const formData = {
      ...this.cicloForm.value
    };

    if (this.editingCicloId()) {
      this.ciclosService.updateCiclo(this.editingCicloId()!, formData).subscribe({
        next: () => {
          this.cargarCiclos();
          this.closeModal();
        }
      });
    } else {
      this.ciclosService.createCiclo(formData).subscribe({
        next: () => {
          this.cargarCiclos();
          this.closeModal();
        }
      });
    }
  }

  darDeBaja(id: string): void {
    if (confirm('¿Está seguro de desactivar este ciclo?')) {
      this.ciclosService.updateCiclo(id, { activo: false }).subscribe({
        next: () => this.cargarCiclos()
      });
    }
  }

  getCarreraNombre(carreraId: string): string {
    const match = this.carreras().find(c => String(c.id) === String(carreraId));
    return match ? match.nombre : `Carrera ID: ${carreraId}`;
  }
}