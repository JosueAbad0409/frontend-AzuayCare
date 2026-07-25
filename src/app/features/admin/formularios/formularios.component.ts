import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormularioService } from '../formulario/formulario.service';
import { PeriodoService } from '../../../core/services/periodo/periodo.service';
import { Formulario } from '../../../core/models/formulario.model';
import { PeriodoMatricula } from '../../../core/models/periodo.model';

@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormulariosComponent implements OnInit {
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  formularios = signal<Formulario[]>([]);
  periodos = signal<PeriodoMatricula[]>([]);
  isLoading = signal<boolean>(true);
  showModal = signal<boolean>(false);

  formGroup: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(255)]],
    descripcion: [''],
    periodo_id: ['', Validators.required],
    tipo: ['SOCIOECONOMICO', Validators.required]
  });

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.isLoading.set(true);
    
    this.periodoService.getPeriodos().subscribe({
      next: (pers) => this.periodos.set(pers),
      error: (err) => console.error('Error al cargar periodos:', err)
    });

    this.formularioService.getFormularios().subscribe({
      next: (forms) => {
        this.formularios.set(forms);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar formularios:', err);
        this.isLoading.set(false);
      }
    });
  }

  abrirModalCrear() {
    const periodoActivo = this.periodos().find(p => p.activo);
    this.formGroup.reset({
      tipo: 'SOCIOECONOMICO',
      periodo_id: periodoActivo ? periodoActivo.id : ''
    });
    this.showModal.set(true);
  }

  guardarFormulario() {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    this.formularioService.createFormulario(this.formGroup.value).subscribe({
      next: (nuevoForm) => {
        this.showModal.set(false);
        this.router.navigate(['/admin/formularios/builder', nuevoForm.id]);
      },
      error: (err) => console.error('Error al crear formulario:', err)
    });
  }

  eliminarFormulario(id: string, e: Event) {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar esta ficha en borrador?')) {
      this.formularioService.deleteFormulario(id).subscribe({
        next: () => this.cargarDatos(),
        error: (err) => alert(err?.error?.message || 'No se puede eliminar un formulario que ya ha sido publicado.')
      });
    }
  }
}