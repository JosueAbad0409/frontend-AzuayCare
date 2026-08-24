import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerfilCoordinadorService } from '../../../core/services/perfil-coordinador.service';
import { AyudaEstudianteResponse } from '../../../core/models/ayuda-estudiante.model';

type PestanaAyuda = 'bienestar' | 'coordinador';

@Component({
  selector: 'app-estudiante-ayuda-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estudiante-ayuda-modal.component.html',
  styleUrl: './estudiante-ayuda-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstudianteAyudaModalComponent implements OnInit {
  private readonly perfilCoordinadorService = inject(PerfilCoordinadorService);

  readonly cerrar = output<void>();

  readonly isLoading = signal(true);
  readonly error = signal(false);
  readonly datos = signal<AyudaEstudianteResponse | null>(null);
  readonly pestanaActiva = signal<PestanaAyuda>('bienestar');
  readonly fotoAmpliada = signal<{ url: string; alt: string } | null>(null);

  ngOnInit(): void {
    this.cargarAyuda();
  }

  cargarAyuda(): void {
    this.isLoading.set(true);
    this.error.set(false);
    this.perfilCoordinadorService.obtenerAyudaEstudiante().subscribe({
      next: (respuesta) => {
        this.datos.set(respuesta);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.isLoading.set(false);
      },
    });
  }

  cambiarPestana(pestana: PestanaAyuda): void {
    this.pestanaActiva.set(pestana);
  }

  cerrarModal(): void {
    this.cerrar.emit();
  }

  ampliarFoto(url: string | null | undefined, alt: string): void {
    if (url) {
      this.fotoAmpliada.set({ url, alt });
    }
  }

  cerrarFotoAmpliada(): void {
    this.fotoAmpliada.set(null);
  }

  getIniciales(nombre: string | undefined): string {
    if (!nombre) return 'U';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return 'U';
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
}