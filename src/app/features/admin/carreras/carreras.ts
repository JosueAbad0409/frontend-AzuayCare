import { Component, OnInit, inject, signal } from '@angular/core';
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
// IMPORTANTE: Mantenemos el nombre con "Component" al final
export class Carreras implements OnInit {
  private readonly carreraService = inject(CarreraService);
  
  carreras = signal<Carrera[]>([]);
  isLoading = signal<boolean>(true);
  
  showForm = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  currentId = signal<string | null>(null);
  
  // SOLUCIÓN: Inyectamos el FormBuilder directamente aquí para evitar el error de "undefined"
  carreraForm: FormGroup = inject(FormBuilder).group({
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
    console.log('¡Botón Nueva Carrera presionado!'); // <- Si esto sale en F12, el click funciona
    this.carreraForm.reset();
    this.isEditing.set(false);
    this.currentId.set(null);
    this.showForm.set(true);
  }

  abrirEditarFormulario(carrera: Carrera) {
    console.log('¡Botón Editar presionado!', carrera);
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

  // --- PETICIONES AL BACKEND (CRUD) ---

  guardarCarrera() {
    if (this.carreraForm.invalid) {
      console.log('Formulario inválido, revisa los campos requeridos.');
      this.carreraForm.markAllAsTouched();
      return;
    }

    const formData = this.carreraForm.value;
    console.log('Enviando datos al backend...', formData);

    if (this.isEditing() && this.currentId()) {
      this.carreraService.updateCarrera(this.currentId()!, formData).subscribe({
        next: () => {
          this.cargarCarreras(); 
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al actualizar', err)
      });
    } else {
      this.carreraService.createCarrera(formData).subscribe({
        next: () => {
          this.cargarCarreras(); 
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