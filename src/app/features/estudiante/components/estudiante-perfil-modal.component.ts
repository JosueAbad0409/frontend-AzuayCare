import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstudiantePerfil } from '../../../core/models/estudiante-perfil.model';

@Component({
  selector: 'app-estudiante-perfil-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estudiante-perfil-modal.component.html',
  styleUrls: ['./estudiante-perfil-modal.component.css'],
})
export class EstudiantePerfilModalComponent {
  @Input({ required: true }) perfil!: EstudiantePerfil | null;
  @Input() visible = false;
  @Output() cerrar = new EventEmitter<void>();

  get inicialNombre(): string {
    const n = this.perfil?.primer_nombre || this.perfil?.correo || 'U';
    return n.charAt(0).toUpperCase();
  }

  get nombres(): string {
  if (!this.perfil) return '—';
  const t = [this.perfil.primer_nombre, this.perfil.segundo_nombre]
    .filter(Boolean)
    .join(' ')
    .trim();
  return t || '—';
}

get apellidos(): string {
  if (!this.perfil) return '—';
  const t = [this.perfil.primer_apellido, this.perfil.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .trim();
  return t || '—';
}

  get nombreCompleto(): string {
    if (!this.perfil) return 'Estudiante';
    const parts = [
      this.perfil.primer_nombre,
      this.perfil.segundo_nombre,
      this.perfil.primer_apellido,
      this.perfil.segundo_apellido,
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : (this.perfil.correo || 'Estudiante');
  }

  get fechaNacimientoFormateada(): string {
    const f = this.perfil?.fecha_nacimiento;
    if (!f) return '—';
    const d = typeof f === 'string' ? new Date(f) : f;
    if (isNaN(d.getTime())) return String(f);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  siNo(v: boolean | null | undefined): string {
    if (v === true) return 'Sí';
    if (v === false) return 'No';
    return '—';
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.visible) this.onCerrarModal();
  }

  onCerrarModal(): void {
    this.cerrar.emit();
  }
}