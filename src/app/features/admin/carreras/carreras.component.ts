import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Carrera } from '../../../core/models/carrera.model';
import { CarreraService } from '../../../core/services/carrera/carrera.service';

@Component({
  selector: 'app-carreras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './carreras.component.html',
  styleUrls: ['./carreras.component.css']
})
export class Carreras implements OnInit {
  private readonly carreraService = inject(CarreraService);
  
  carreras = signal<Carrera[]>([]);
  isLoading = signal<boolean>(true);
  searchTerm = signal<string>('');
  
  showForm = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  currentId = signal<string | null>(null);
  
  carreraForm: FormGroup = inject(FormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    correo_institucional: ['', [Validators.required, Validators.email, Validators.maxLength(150)]]
  });

  // Signal calculada para filtrar la tabla al instante sin recargar el backend
  carrerasFiltradas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.carreras();
    return this.carreras().filter(c => 
      c.nombre.toLowerCase().includes(term) || 
      c.correo_institucional.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.cargarCarreras();
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  cargarCarreras() {
    this.isLoading.set(true);
    this.carreraService.getCarreras().subscribe({
      next: (data) => {
        this.carreras.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar carreras:', err);
        this.isLoading.set(false);
      }
    });
  }

  abrirNuevoFormulario() {
    this.carreraForm.reset();
    this.isEditing.set(false);
    this.currentId.set(null);
    this.showForm.set(true);
  }

  abrirEditarFormulario(carrera: Carrera) {
    this.isEditing.set(true);
    this.currentId.set(carrera.id);
    this.carreraForm.patchValue({
      nombre: carrera.nombre,
      correo_institucional: carrera.correo_institucional
    });
    this.showForm.set(true);
  }

  cancelarFormulario() {
    this.showForm.set(false);
    this.carreraForm.reset();
  }

  guardarCarrera() {
    if (this.carreraForm.invalid) {
      this.carreraForm.markAllAsTouched();
      return;
    }

    const formData = this.carreraForm.value;

    if (this.isEditing() && this.currentId()) {
      this.carreraService.updateCarrera(this.currentId()!, formData).subscribe({
        next: () => {
          this.cargarCarreras(); 
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al actualizar carrera:', err)
      });
    } else {
      this.carreraService.createCarrera(formData).subscribe({
        next: () => {
          this.cargarCarreras(); 
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al crear carrera:', err)
      });
    }
  }

  eliminarCarrera(id: string) {
    if (confirm('¿Estás seguro de eliminar esta carrera? Esta acción no se puede deshacer.')) {
      this.carreraService.deleteCarrera(id).subscribe({
        next: () => this.cargarCarreras(),
        error: (err) => console.error('Error al eliminar carrera:', err)
      });
    }
  }
}