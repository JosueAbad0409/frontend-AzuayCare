// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\features\admin\perfil-coordinador-form\perfil-coordinador-form.component.ts
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

  // Expresión regular corregida para permitir números, prefijos (+), espacios, guiones y extensiones (ext. 104)
  perfilForm: FormGroup = this.fb.group({
    usuario_id: [this.usuarioIdActual, Validators.required],
    titulo_profesional: ['', [Validators.required, Validators.minLength(5)]],
    ubicacion_oficina: ['', Validators.required],
    horario_atencion: ['', Validators.required],
    telefono_contacto: ['', [
      Validators.required, 
      Validators.pattern('^[0-9+ \\-.a-zA-ZáéíóúÁÉÍÓÚñÑ]+$')
    ]],
    mensaje_ayuda_estudiantes: ['']
  });

  ngOnInit(): void {
    if (this.usuarioIdActual) {
      this.cargarPerfil();
    }
  }

  cargarPerfil(): void {
    this.loading.set(true);

    this.perfilService.getPerfilByUsuario(this.usuarioIdActual).subscribe({
      next: (perfil: any) => {
        if (perfil) {
          // Mapeo defensivo para homogeneizar respuestas en snake_case o camelCase
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