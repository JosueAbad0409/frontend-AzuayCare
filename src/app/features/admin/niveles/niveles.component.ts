import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, finalize, debounceTime } from 'rxjs';
import Swal from 'sweetalert2';

import { FichaService } from '../../../core/services/ficha.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-niveles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './niveles.component.html',
  styleUrls: ['./niveles.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NivelesComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly periodoService = inject(PeriodoService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly apiUrl = `${environment.apiUrl}/niveles-economicos`;

  readonly niveles = signal<any[]>([]);
  readonly periodos = signal<any[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly showForm = signal<boolean>(false);

  readonly filterNombre = signal<string>('');
  readonly filterPeriodo = signal<string>('TODOS');

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly nivelForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    valor_min: [0, [Validators.required, Validators.min(0)]],
    valor_max: [null],
    periodo_id: ['', Validators.required],
    orden: [1, Validators.required]
  });

  readonly periodosDisponibles = computed(() => {
    return this.periodos();
  });

  readonly nivelesFiltrados = computed(() => {
    const term = this.filterNombre().toLowerCase().trim();
    const periodoId = this.filterPeriodo();

    return this.niveles().filter(n => {
      const coincideNombre = !term || n.nombre?.toLowerCase().includes(term);
      const coincidePeriodo = periodoId === 'TODOS' || n.periodo_id === periodoId;
      return coincideNombre && coincidePeriodo;
    });
  });

  readonly totalCasos = computed(() => this.nivelesFiltrados().length);

  readonly tieneFiltrosActivos = computed(() => {
    return !!this.filterNombre() || this.filterPeriodo() !== 'TODOS';
  });

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400))
      .subscribe(val => this.filterNombre.set(val));

    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchNombreChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onPeriodoFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterPeriodo.set(value);
  }

  limpiarFiltros(): void {
    this.filterNombre.set('');
    this.filterPeriodo.set('TODOS');
  }

  toggleForm(): void {
    const nuevoEstado = !this.showForm();
    this.showForm.set(nuevoEstado);
    if (!nuevoEstado) {
      this.nivelForm.reset({ orden: 1, valor_min: 0 });
    }
  }

  cargarDatos(): void {
    this.isLoading.set(true);

    this.periodoService.getPeriodos().subscribe({
      next: (p) => this.periodos.set(p || [])
    });

    this.http.get<any[]>(this.apiUrl)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.niveles.set(data || []),
        error: () => {
          this.toastService.show('Error al obtener niveles económicos.', 'error');
        }
      });
  }

  obtenerNombrePeriodo(periodoId: string): string {
    const encontrado = this.periodos().find(p => p.id === periodoId);
    return encontrado ? encontrado.nombre : 'General / Sin Periodo';
  }

  guardarNivel(): void {
    if (this.nivelForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);

    this.http.post(this.apiUrl, this.nivelForm.value)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Nivel económico guardado correctamente.', 'success');
          this.nivelForm.reset({ orden: 1, valor_min: 0 });
          this.showForm.set(false);
          this.cargarDatos();
        },
        error: (err) => {
          this.toastService.show(err?.error?.message || 'Error al guardar nivel.', 'error');
        }
      });
  }

  eliminarNivel(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Dar de baja este nivel?',
      text: 'El nivel socioeconómico dejará de estar disponible para la asignación automática.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm custom-swal-danger',
        cancelButton: 'custom-swal-cancel'
      },
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-trash-alt" aria-hidden="true"></i> <span>Sí, dar de baja</span>',
      cancelButtonText: '<i class="fas fa-times" aria-hidden="true"></i> <span>Cancelar</span>'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.http.delete(`${this.apiUrl}/${id}`)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Nivel económico desactivado.', 'info');
              this.cargarDatos();
            },
            error: (err) => {
              this.toastService.show(err?.error?.message || 'Error al dar de baja el nivel.', 'error');
            }
          });
      }
    });
  }
}