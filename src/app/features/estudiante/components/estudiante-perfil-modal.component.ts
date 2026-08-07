import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstudiantePerfil } from '../../../core/models/estudiante-perfil.model';

@Component({
  selector: 'app-estudiante-perfil-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estudiante-perfil-modal.component.html',
  styleUrls: ['./estudiante-perfil-modal.component.css']
})
export class EstudiantePerfilModalComponent {
  @Input({ required: true }) perfil!: EstudiantePerfil | null;
  @Input() visible: boolean = false;
  @Output() cerrar = new EventEmitter<void>();

  get inicialCorreo(): string {
    return this.perfil?.correo?.charAt(0)?.toUpperCase() || 'U';
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.visible) {
      this.onCerrarModal();
    }
  }

  onCerrarModal(): void {
    this.cerrar.emit();
  }
}