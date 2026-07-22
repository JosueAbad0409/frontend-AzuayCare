import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Carrera } from '../../../core/models/carrera.model';
import { CarreraService } from '../../../core/services/carrera/carrera.service';

@Component({
  selector: 'app-carreras',
  standalone: true,
  // IMPORTANTE: Añadimos ReactiveFormsModule para poder usar formularios
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './carreras.component.html',
  styleUrls: ['./carreras.component.css']
})
export class Carreras implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly fb = inject(FormBuilder);
  
  carreras = signal<Carrera[]>([]);
  isLoading = signal<boolean>(true);
  
  // Variables para controlar la tarjeta del formulario
  showForm = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  currentId = signal<string | null>(null);
  
  // Nuestro formulario reactivo con las validaciones de tu DTO
  carreraForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    correo_institucional: ['', [Validators.required, Validators.email, Validators.maxLength(150)]]
  });

  ngOnInit() {
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
        console.error('Error al cargar', err);
        this.isLoading.set(false);
      }
    });
  }

  // --- BOTONES DE ACCIÓN ---

  abrirNuevoFormulario() {
    this.carreraForm.reset();
    this.isEditing.set(false);
    this.currentId.set(null);
    this.showForm.set(true);
  }

  abrirEditarFormulario(carrera: Carrera) {
    this.isEditing.set(true);
    this.currentId.set(carrera.id);
    // Llenamos el formulario con los datos actuales
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

  // --- PETICIONES AL BACKEND (CRUD) ---

  guardarCarrera() {
    if (this.carreraForm.invalid) {
      this.carreraForm.markAllAsTouched();
      return;
    }

    const formData = this.carreraForm.value;

    if (this.isEditing() && this.currentId()) {
      // ACTUALIZAR
      this.carreraService.updateCarrera(this.currentId()!, formData).subscribe({
        next: () => {
          this.cargarCarreras(); // Recargamos la tabla
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al actualizar', err)
      });
    } else {
      // CREAR
      this.carreraService.createCarrera(formData).subscribe({
        next: () => {
          this.cargarCarreras(); // Recargamos la tabla
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al crear', err)
      });
    }
  }

  eliminarCarrera(id: string) {
    if (confirm('¿Estás seguro de eliminar esta carrera? Esta acción no se puede deshacer.')) {
      this.carreraService.deleteCarrera(id).subscribe({
        next: () => this.cargarCarreras(),
        error: (err) => console.error('Error al eliminar', err)
      });
    }
  }
}