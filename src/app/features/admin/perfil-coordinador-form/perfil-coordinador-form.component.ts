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
  styleUrl: './perfil-coordinador-form.component.css'
})
export class PerfilCoordinadorFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly perfilService = inject(PerfilCoordinadorService);
  private readonly authService = inject(AuthService);

  loading = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  usuarioIdActual = this.authService.user()?.id || localStorage.getItem('usuarioId') || '';

  // Configuración del Formulario Reactivo con validaciones completas
  perfilForm: FormGroup = this.fb.group({
    usuario_id: [this.usuarioIdActual, Validators.required],
    titulo_profesional: ['', [Validators.required, Validators.minLength(3)]],
    ubicacion_oficina: ['', Validators.required],
    horario_atencion: ['', Validators.required],
    telefono_contacto: ['', [
      Validators.required, 
      Validators.pattern('^[0-9+ \\-.a-zA-ZáéíóúÁÉÍÓÚñÑ]+$')
    ]],
    mensaje_ayuda_estudiantes: ['', [Validators.maxLength(500)]]
  });

  ngOnInit(): void {
    if (this.usuarioIdActual) {
      this.cargarPerfil();
    }
  }

  // Resuelve los errores TS2339 en la plantilla HTML al validar campos
  isFieldInvalid(fieldName: string): boolean {
    const field = this.perfilForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Permite cerrar las alertas manualmente desde la UI
  limpiarAlertas(): void {
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  cargarPerfil(): void {
    this.loading.set(true);

    this.perfilService.getPerfilByUsuario(this.usuarioIdActual).subscribe({
      next: (perfil: any) => {
        if (perfil) {
          // Mapeo defensivo para snake_case o camelCase
          this.perfilForm.patchValue({
            usuario_id: perfil.usuario_id || perfil.usuarioId || this.usuarioIdActual,
            titulo_profesional: perfil.titulo_profesional || perfil.tituloProfesional || '',
            ubicacion_oficina: perfil.ubicacion_oficina || perfil.ubicacionOficina || '',
            horario_atencion: perfil.horario_atencion || perfil.horarioAtencion || '',
            telefono_contacto: perfil.telefono_contacto || perfil.telefonoContacto || '',
            mensaje_ayuda_estudiantes: perfil.mensaje_ayuda_estudiantes || perfil.mensajeAyuda || ''
          });
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
    this.limpiarAlertas();

    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    
    this.perfilService.saveOrUpdatePerfil(this.perfilForm.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.mensajeExito.set('Perfil de atención actualizado correctamente.');
        setTimeout(() => this.mensajeExito.set(null), 3500);
      },
      error: (err) => {
        console.error('Error al guardar perfil:', err);
        this.loading.set(false);
        this.mensajeError.set('Ocurrió un error al guardar el perfil.');
      }
    });
  }
}