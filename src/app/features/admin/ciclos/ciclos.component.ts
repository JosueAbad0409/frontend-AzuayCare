import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CiclosService } from '../../../core/services/ciclos.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { ToastService } from '../../../core/services/toast.service';
import { Ciclo } from '../../../core/models/ciclo.model';
import { Carrera } from '../../../core/models/carrera.model';

@Component({
  selector: 'app-ciclos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ciclos.component.html',
  styleUrls: ['./ciclos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CiclosComponent implements OnInit {
  private readonly ciclosService = inject(CiclosService);
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  ciclos = signal<Ciclo[]>([]);
  carreras = signal<Carrera[]>([]);
  loading = signal<boolean>(false);
  modalOpen = signal<boolean>(false);
  editingCicloId = signal<string | null>(null);
  searchTerm = signal<string>('');

  // CORRECCIÓN: Homologado a 'carrera_id' para que coincida con el backend
  cicloForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    carrera_id: ['', [Validators.required]]
  });

  ciclosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.ciclos();
    return this.ciclos().filter(c => 
      c.nombre.toLowerCase().includes(term) || 
      (c.carrera?.nombre || '').toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.cargarCarreras();
    this.cargarCiclos();
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
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
        this.toastService.show('Error al cargar los ciclos académicos.', 'error');
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
        carrera_id: ciclo.carrera_id
      });
    } else {
      this.editingCicloId.set(null);
      this.cicloForm.reset({ carrera_id: '' });
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

    const formData = this.cicloForm.value;

    if (this.editingCicloId()) {
      this.ciclosService.updateCiclo(this.editingCicloId()!, formData).subscribe({
        next: () => {
          this.toastService.show('Ciclo actualizado correctamente.', 'success');
          this.cargarCiclos();
          this.closeModal();
        },
        error: (err) => this.toastService.show(err?.error?.message || 'Error al actualizar', 'error')
      });
    } else {
      this.ciclosService.createCiclo(formData).subscribe({
        next: () => {
          this.toastService.show('Ciclo registrado correctamente.', 'success');
          this.cargarCiclos();
          this.closeModal();
        },
        error: (err) => this.toastService.show(err?.error?.message || 'Error al crear el ciclo', 'error')
      });
    }
  }

  darDeBaja(id: string): void {
    // CORRECCIÓN: Ahora usa el método delete (borrado lógico) correspondiente en el Backend
    if (confirm('¿Está seguro de eliminar/desactivar este ciclo?')) {
      this.ciclosService.deleteCiclo(id).subscribe({
        next: () => {
          this.toastService.show('Ciclo desactivado con éxito.', 'info');
          this.cargarCiclos();
        },
        error: (err) => this.toastService.show('Error al eliminar el ciclo.', 'error')
      });
    }
  }

  getCarreraNombre(carreraId: string): string {
    const match = this.carreras().find(c => String(c.id) === String(carreraId));
    return match ? match.nombre : 'Desconocida';
  }
}