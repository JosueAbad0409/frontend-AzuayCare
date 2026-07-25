import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PerfilCoordinadorService } from '../../../core/services/perfil-coordinador.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-perfil-coordinador-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil-coordinador-form.component.html',
  styleUrls: ['./perfil-coordinador-form.component.css']
})
export class PerfilCoordinadorFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly perfilService = inject(PerfilCoordinadorService);
  private readonly authService = inject(AuthService);

  loading = signal<boolean>(false);
  mensajeExito = signal<string>('');
  mensajeError = signal<string>('');

  usuarioIdActual = this.authService.user()?.id || localStorage.getItem('usuarioId') || '';

  perfilForm: FormGroup = this.fb.group({
    usuarioId: [this.usuarioIdActual, Validators.required],
    tituloProfesional: ['', [Validators.required, Validators.minLength(5)]],
    ubicacionOficina: ['', Validators.required],
    horarioAtencion: ['', Validators.required],
    telefonoContacto: ['', [Validators.required, Validators.pattern('^[0-9+ ]+$')]],
    mensajeAyuda: ['']
  });

  ngOnInit(): void {
    if (this.usuarioIdActual) {
      this.cargarPerfil();
    }
  }

  cargarPerfil(): void {
    this.loading.set(true);

    this.perfilService.getPerfilByUsuario(this.usuarioIdActual).subscribe({
      next: (perfil) => {
        if (perfil) {
          this.perfilForm.patchValue(perfil);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar perfil:', err);
        this.loading.set(false);
      }
    });
  }

  guardar(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');

    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.perfilService.saveOrUpdatePerfil(this.perfilForm.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.mensajeExito.set('Perfil de atención actualizado correctamente.');
        setTimeout(() => this.mensajeExito.set(''), 3500);
      },
      error: (err) => {
        console.error('Error al guardar perfil:', err);
        this.loading.set(false);
        this.mensajeError.set('Ocurrió un error al guardar el perfil.');
      }
    });
  }
}