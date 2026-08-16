import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { FichaService } from '../../../core/services/ficha.service';
import { FichaRevision } from '../../../core/models/revision-ficha.model';

@Component({
  selector: 'app-estudiante-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estudiante-inicio.component.html',
  styleUrls: ['./estudiante-inicio.component.css']
})
export class EstudianteInicioComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly fichaService = inject(FichaService);
  private readonly destroyRef = inject(DestroyRef);

  fichaActiva = signal<FichaRevision | null>(null);
  isLoading = signal<boolean>(true);

  usuario = computed(() => this.authService.user());

  nombreUsuario = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre.trim().split(' ')[0] || 'Estudiante';
  });

  esEstudiante = computed(() => {
    return this.usuario()?.rol === 'ESTUDIANTE';
  });

  ngOnInit(): void {
    this.fichaService.getMisFichas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fichas: FichaRevision[]) => {
          if (fichas && fichas.length > 0) {
            const activa = fichas.find(f => f.estado_ficha === 'BORRADOR' || f.estado_ficha === 'ENVIADA') || fichas[0];
            this.fichaActiva.set(activa);
          }
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          console.error('Error al cargar la ficha del estudiante:', err);
          this.isLoading.set(false);
        }
      });
  }
}