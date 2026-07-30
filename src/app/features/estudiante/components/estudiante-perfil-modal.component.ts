import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstudiantePerfil } from '../../../core/models/estudiante-perfil.model';

@Component({
  selector: 'app-estudiante-perfil-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estudiante-perfil-modal.component.html',
  styleUrls: ['./estudiante-perfil-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstudiantePerfilModalComponent {
  @Input({ required: true }) perfil!: EstudiantePerfil | null;
  @Input() visible: boolean = false;
  @Output() cerrar = new EventEmitter<void>();

  onCerrarModal(): void {
    this.cerrar.emit();
  }
}