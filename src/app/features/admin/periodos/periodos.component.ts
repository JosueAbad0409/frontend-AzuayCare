import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { PeriodoService } from '../../../core/services/periodo/periodo.service';

@Component({
  selector: 'app-periodos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './periodos.component.html',
  styleUrls: ['./periodos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodosComponent implements OnInit {
  private readonly periodoService = inject(PeriodoService);
  private readonly fb = inject(FormBuilder);
  
  periodos = signal<PeriodoMatricula[]>([]);
  isLoading = signal<boolean>(true);
  searchTerm = signal<string>('');
  
  showForm = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  currentId = signal<string | null>(null);
  
  periodoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    activo: [false]
  });

  periodosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.periodos();
    return this.periodos().filter(p => p.nombre.toLowerCase().includes(term));
  });

  ngOnInit() {
    this.cargarPeriodos();
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  cargarPeriodos() {
    this.isLoading.set(true);
    this.periodoService.getPeriodos().subscribe({
      next: (data) => {
        this.periodos.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar periodos:', err);
        this.isLoading.set(false);
      }
    });
  }

  abrirNuevoFormulario() {
    this.periodoForm.reset({ activo: false });
    this.isEditing.set(false);
    this.currentId.set(null);
    this.showForm.set(true);
  }

  abrirEditarFormulario(periodo: PeriodoMatricula) {
    this.isEditing.set(true);
    this.currentId.set(periodo.id);
    
    const formatearFecha = (fecha: string) => fecha ? fecha.split('T')[0] : '';

    this.periodoForm.patchValue({
      nombre: periodo.nombre,
      fecha_inicio: formatearFecha(periodo.fecha_inicio),
      fecha_fin: formatearFecha(periodo.fecha_fin),
      activo: periodo.activo
    });
    this.showForm.set(true);
  }

  cancelarFormulario() {
    this.showForm.set(false);
    this.periodoForm.reset();
  }

  guardarPeriodo() {
    if (this.periodoForm.invalid) {
      this.periodoForm.markAllAsTouched();
      return;
    }

    const formData = this.periodoForm.value;

    if (this.isEditing() && this.currentId()) {
      this.periodoService.updatePeriodo(this.currentId()!, formData).subscribe({
        next: () => {
          this.cargarPeriodos(); 
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al actualizar periodo:', err)
      });
    } else {
      this.periodoService.createPeriodo(formData).subscribe({
        next: () => {
          this.cargarPeriodos(); 
          this.cancelarFormulario();
        },
        error: (err) => console.error('Error al crear periodo:', err)
      });
    }
  }

  eliminarPeriodo(id: string) {
    if (confirm('¿Estás seguro de eliminar este periodo? Los formularios enlazados podrían verse afectados.')) {
      this.periodoService.deletePeriodo(id).subscribe({
        next: () => this.cargarPeriodos(),
        error: (err) => console.error('Error al eliminar periodo:', err)
      });
    }
  }
}