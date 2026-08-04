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

  // Formulario Reactivo con Validaciones Estrictas
  perfilForm: FormGroup = this.fb.group({
    usuario_id: [this.usuarioIdActual, [Validators.required]],
    titulo_profesional: ['', [
      Validators.required, 
      Validators.minLength(3), 
      Validators.maxLength(100)
    ]],
    ubicacion_oficina: ['', [
      Validators.required, 
      Validators.minLength(3), 
      Validators.maxLength(150)
    ]],
    horario_atencion: ['', [
      Validators.required, 
      Validators.minLength(5), 
      Validators.maxLength(100)
    ]],
    // Validar celular Ecuador: empieza con 09 y consta de 10 dígitos exactamente
    telefono_contacto: ['', [
      Validators.required, 
      Validators.pattern(/^09\d{8}$/)
    ]],
    mensaje_ayuda_estudiantes: ['', [
      Validators.maxLength(500)
    ]]
  });

  ngOnInit(): void {
    if (this.usuarioIdActual) {
      this.cargarPerfil();
    } else {
      this.mensajeError.set('No se encontró una sesión activa de usuario.');
    }
  }

  // Sanitiza el teléfono mientras el usuario escribe para admitir solo dígitos
  onTelefonoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valorLimpio = input.value.replace(/\D/g, '').slice(0, 10);
    this.perfilForm.patchValue({ telefono_contacto: valorLimpio }, { emitEvent: false });
  }

  // Verifica el estado de validez de los campos para la plantilla
  isFieldInvalid(fieldName: string): boolean {
    const field = this.perfilForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  limpiarAlertas(): void {
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  cargarPerfil(): void {
    this.loading.set(true);

    this.perfilService.getPerfilByUsuario(this.usuarioIdActual).subscribe({
      next: (perfil: any) => {
        if (perfil) {
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
        this.mensajeError.set('No se pudo cargar la información del perfil.');
      }
    });
  }

  guardar(): void {
    this.limpiarAlertas();

    // Verificación de sesión
    if (!this.usuarioIdActual) {
      this.mensajeError.set('Sesión no válida. Por favor, vuelve a iniciar sesión.');
      return;
    }

    // Marca campos tocados si el formulario es inválido
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      this.mensajeError.set('Por favor, completa correctamente todos los campos obligatorios.');
      return;
    }

    // Sanitización y limpieza de espacios en blanco al inicio/final
    const formValues = this.perfilForm.value;
    const datosLimpios = {
      usuario_id: this.usuarioIdActual,
      titulo_profesional: formValues.titulo_profesional?.trim(),
      ubicacion_oficina: formValues.ubicacion_oficina?.trim(),
      horario_atencion: formValues.horario_atencion?.trim(),
      telefono_contacto: formValues.telefono_contacto?.trim(),
      mensaje_ayuda_estudiantes: formValues.mensaje_ayuda_estudiantes?.trim() || null
    };

    this.loading.set(true);

    this.perfilService.saveOrUpdatePerfil(datosLimpios).subscribe({
      next: () => {
        this.loading.set(false);
        this.mensajeExito.set('Perfil de atención guardado y actualizado con éxito.');
        setTimeout(() => this.mensajeExito.set(null), 4000);
      },
      error: (err) => {
        console.error('Error al guardar perfil:', err);
        this.loading.set(false);
        this.mensajeError.set('Ocurrió un problema al guardar los cambios en el servidor.');
      }
    });
  }
}