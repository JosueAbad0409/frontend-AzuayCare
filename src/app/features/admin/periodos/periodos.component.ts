import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, finalize, debounceTime } from 'rxjs';
import Swal from 'sweetalert2';

import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-periodos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './periodos.component.html',
  styleUrls: ['./periodos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodosComponent implements OnInit, OnDestroy {
  private readonly periodoService = inject(PeriodoService);
  private readonly toastService = inject(ToastService);

  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  readonly searchTerm = signal<string>('');
  readonly filtroNombreSelect = signal<string>('TODOS');
  readonly filtroFechaInicio = signal<string>('');
  readonly filtroFechaFin = signal<string>('');
  readonly filtroEstado = signal<string>('TODOS');

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly nombresPeriodosDisponibles = computed(() => {
    const set = new Set<string>();
    this.periodos().forEach(p => {
      if (p.nombre) set.add(p.nombre);
    });
    return Array.from(set);
  });

  readonly periodosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const nombreSel = this.filtroNombreSelect();
    const fInicio = this.filtroFechaInicio();
    const fFin = this.filtroFechaFin();
    const estado = this.filtroEstado();

    return this.periodos().filter(p => {
      const coincideTexto = !term || p.nombre.toLowerCase().includes(term);
      const coincideNombreCombo = nombreSel === 'TODOS' || p.nombre === nombreSel;

      let coincideEstado = true;
      if (estado === 'ACTIVO') coincideEstado = !!p.activo;
      else if (estado === 'INACTIVO') coincideEstado = !p.activo;

      let coincideFechas = true;
      if (fInicio) {
        const pInicio = p.fecha_inicio ? new Date(p.fecha_inicio.split('T')[0]) : null;
        const filtroInicio = new Date(fInicio);
        if (pInicio && pInicio < filtroInicio) coincideFechas = false;
      }
      if (fFin && coincideFechas) {
        const pFin = p.fecha_fin ? new Date(p.fecha_fin.split('T')[0]) : null;
        const filtroFin = new Date(fFin);
        if (pFin && pFin > filtroFin) coincideFechas = false;
      }

      return coincideTexto && coincideNombreCombo && coincideEstado && coincideFechas;
    });
  });

  readonly tieneFiltrosActivos = computed(() => {
    return !!this.searchTerm() ||
      this.filtroNombreSelect() !== 'TODOS' ||
      !!this.filtroFechaInicio() ||
      !!this.filtroFechaFin() ||
      this.filtroEstado() !== 'TODOS';
  });

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400))
      .subscribe(val => this.searchTerm.set(val));

    this.cargarPeriodos();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onNombreSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtroNombreSelect.set(value);
  }

  onFechaInicioChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filtroFechaInicio.set(value);
  }

  onFechaFinChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filtroFechaFin.set(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtroEstado.set(value);
  }

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.filtroNombreSelect.set('TODOS');
    this.filtroFechaInicio.set('');
    this.filtroFechaFin.set('');
    this.filtroEstado.set('TODOS');
  }

  cargarPeriodos(): void {
    this.isLoading.set(true);
    this.periodoService.getPeriodos()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.periodos.set(data || []),
        error: (err: HttpErrorResponse) => {
          this.toastService.show('Error al obtener la lista de periodos.', 'error');
        }
      });
  }
  /**
   * Calcula automáticamente las fechas y el nombre del próximo periodo 
   * basándose en el último periodo registrado en el sistema.
   */
  private calcularSugerenciaFechas(): { nombre: string; inicio: string; fin: string } {
    const lista = this.periodos();
    
    // Si no hay periodos, sugerimos desde el mes actual
    if (!lista || lista.length === 0) {
      const hoy = new Date();
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 5, 0); 
      return { nombre: 'Nuevo Periodo', inicio: this.formatearFechaInput(hoy), fin: this.formatearFechaInput(fin) };
    }

    // Buscamos el periodo con la fecha de fin más reciente
    const ultimoPeriodo = lista.reduce((prev, current) => {
      const fechaPrev = new Date(prev.fecha_fin || 0);
      const fechaCurr = new Date(current.fecha_fin || 0);
      return (fechaPrev > fechaCurr) ? prev : current;
    });

    const ultimaFechaFin = new Date(ultimoPeriodo.fecha_fin + 'T00:00:00');

    // Sugerencia: Inicia el día 1 del MES SIGUIENTE al que terminó el último periodo
    const sugInicio = new Date(ultimaFechaFin.getFullYear(), ultimaFechaFin.getMonth() + 1, 1);
    
    // Sugerencia: Termina el último día del mes, 4 meses después (ciclo de 5 meses)
    const sugFin = new Date(sugInicio.getFullYear(), sugInicio.getMonth() + 5, 0);

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const nombreSugerido = `${meses[sugInicio.getMonth()]} - ${meses[sugFin.getMonth()]} ${sugInicio.getFullYear()}`;

    return {
      nombre: nombreSugerido,
      inicio: this.formatearFechaInput(sugInicio),
      fin: this.formatearFechaInput(sugFin)
    };
  }

  private formatearFechaInput(d: Date): string {
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const dia = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }
  // 🔥 Evita que el usuario escriba más de 4 dígitos en el año (bloquea locuras como 555555)
  limitarAnioInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const partes = input.value.split('-'); // Formato YYYY-MM-DD
      if (partes[0] && partes[0].length > 4) {
        partes[0] = partes[0].slice(0, 4); // Corta a máximo 4 dígitos
        input.value = partes.join('-');
      }
    }
  }

abrirFormularioSwal(periodo?: PeriodoMatricula): void {
    const isEditing = !!periodo;
    const titleText = isEditing ? 'Editar Periodo' : 'Registrar Nuevo Periodo';
    const confirmText = isEditing ? 'Actualizar' : 'Guardar Periodo';

    const formatearFechaStr = (fecha?: string) => fecha ? fecha.split('T')[0] : '';
    
    const sugerencia = !isEditing ? this.calcularSugerenciaFechas() : null;
    
    const nombreVal = isEditing ? periodo.nombre : sugerencia?.nombre;
    const fechaInicioVal = isEditing ? formatearFechaStr(periodo?.fecha_inicio) : sugerencia?.inicio;
    const fechaFinVal = isEditing ? formatearFechaStr(periodo?.fecha_fin) : sugerencia?.fin;
    const activoVal = isEditing && periodo?.activo ? 'checked' : '';

    const helpBanner = !isEditing ? `
      <div style="background: #eff6ff; color: #1e3a8a; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; border: 1px solid #bfdbfe; display: flex; align-items: flex-start; gap: 10px; text-align: left;">
        <i class="fas fa-lightbulb" style="margin-top: 2px; color: #3b82f6;"></i>
        <span><strong>Sugerencia inteligente:</strong> Hemos calculado estas fechas basándonos en el último periodo registrado para evitar cruces. Puedes modificarlas si lo necesitas.</span>
      </div>
    ` : '';

    const anioActual = new Date().getFullYear();
    const anioMinimo = anioActual - 5; 
    const anioMaximo = anioActual + 10; 

    Swal.fire({
      title: titleText,
      width: '550px',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner">
            <i class="fas ${isEditing ? 'fa-calendar-check' : 'fa-calendar-plus'} swal-banner-icon"></i>
            <div>
              <p class="swal-banner-title">${titleText}</p>
              <p class="swal-banner-sub">Configura las fechas de apertura y cierre del ciclo académico</p>
            </div>
          </div>

          ${helpBanner}

          <div class="swal-field-group">
            <label for="swal-nombre" class="swal-form-label">Nombre del Periodo *</label>
            <input id="swal-nombre" type="text" class="swal-form-input" placeholder="Ej. Abril - Agosto 2026" value="${nombreVal}">
          </div>
          
          <div class="swal-form-row">
            <div class="swal-form-col">
              <label for="swal-inicio" class="swal-form-label">Fecha de Inicio *</label>
              <!-- 🔥 BLOQUEO ESTRICTO: min, max y oninput para prohibir más de 4 dígitos -->
              <input id="swal-inicio" type="date" class="swal-form-input" value="${fechaInicioVal}" 
                     min="${anioMinimo}-01-01" max="${anioMaximo}-12-31" 
                     oninput="if(this.value.length > 10) { this.value = ''; }">
            </div>
            <div class="swal-form-col">
              <label for="swal-fin" class="swal-form-label">Fecha de Fin *</label>
              <!-- 🔥 BLOQUEO ESTRICTO: min, max y oninput para prohibir más de 4 dígitos -->
              <input id="swal-fin" type="date" class="swal-form-input" value="${fechaFinVal}" 
                     min="${anioMinimo}-01-01" max="${anioMaximo}-12-31" 
                     oninput="if(this.value.length > 10) { this.value = ''; }">
            </div>
          </div>

          <div class="swal-checkbox-card">
            <input type="checkbox" id="swal-activo" class="swal-checkbox-input" ${activoVal}>
            <label for="swal-activo" class="swal-checkbox-label">
              <span>Establecer como periodo ACTIVO</span>
              <small class="swal-checkbox-sub">Permitirá el ingreso de nuevas fichas estudiantiles</small>
            </label>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: `<i class="fas fa-check" aria-hidden="true"></i> <span>${confirmText}</span>`,
      cancelButtonText: '<i class="fas fa-times" aria-hidden="true"></i> <span>Cancelar</span>',
      buttonsStyling: false,
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value.trim();
        const fecha_inicio = (document.getElementById('swal-inicio') as HTMLInputElement).value;
        const fecha_fin = (document.getElementById('swal-fin') as HTMLInputElement).value;
        const activo = (document.getElementById('swal-activo') as HTMLInputElement).checked;

        if (!nombre) {
          Swal.showValidationMessage('El nombre del periodo es obligatorio.');
          return false;
        }
        if (!fecha_inicio || !fecha_fin) {
          Swal.showValidationMessage('Las fechas son obligatorias y deben tener un año válido de 4 dígitos.');
          return false;
        }
        
        const dInicio = new Date(fecha_inicio + 'T00:00:00');
        const dFin = new Date(fecha_fin + 'T00:00:00');

        const yearInicio = dInicio.getFullYear();
        const yearFin = dFin.getFullYear();
        
        if (yearInicio < anioMinimo || yearInicio > anioMaximo || yearFin < anioMinimo || yearFin > anioMaximo) {
          Swal.showValidationMessage(`Por favor, ingresa un año válido (entre ${anioMinimo} y ${anioMaximo}).`);
          return false;
        }

        if (dInicio >= dFin) {
          Swal.showValidationMessage('La fecha de inicio debe ser anterior a la fecha de fin.');
          return false;
        }

        // VALIDACIÓN ANTI-SOLAPAMIENTO
        const solapado = this.periodos().find(p => {
          if (isEditing && p.id === periodo.id) return false; 
          
          const pInicio = new Date(p.fecha_inicio.split('T')[0] + 'T00:00:00');
          const pFin = new Date(p.fecha_fin.split('T')[0] + 'T00:00:00');
          
          return (dInicio <= pFin) && (dFin >= pInicio);
        });

        if (solapado) {
          Swal.showValidationMessage(`Las fechas chocan con el periodo existente: "${solapado.nombre}".`);
          return false;
        }

        return { nombre, fecha_inicio, fecha_fin, activo };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarPeriodoEnDb(result.value, isEditing ? periodo.id : null);
      }
    });
  }

  guardarPeriodoEnDb(formData: any, id: string | null): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    Swal.fire({
      title: 'Guardando Periodo...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title'
      },
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const peticion$ = id
      ? this.periodoService.updatePeriodo(id, formData)
      : this.periodoService.createPeriodo(formData);

    peticion$.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => {
        Swal.close();
        this.toastService.show(
          id ? 'Periodo actualizado con éxito.' : 'Periodo registrado con éxito.',
          'success'
        );
        this.cargarPeriodos();
      },
      error: (err: HttpErrorResponse) => {
        Swal.fire({
          icon: 'error',
          title: 'Error al Guardar',
          text: this.extraerMensajeError(err, 'Error al procesar la solicitud.'),
          customClass: {
            popup: 'custom-swal-popup',
            confirmButton: 'custom-swal-confirm',
            title: 'custom-swal-title'
          },
          buttonsStyling: false
        });
      }
    });
  }

  eliminarPeriodo(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Eliminar este periodo?',
      text: 'Esta acción no se puede deshacer. Los formularios asociados podrían verse afectados.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm custom-swal-danger',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-trash-alt" aria-hidden="true"></i> <span>Sí, eliminar</span>',
      cancelButtonText: '<i class="fas fa-times" aria-hidden="true"></i> <span>Cancelar</span>'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.periodoService.deletePeriodo(id)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Periodo eliminado con éxito.', 'info');
              this.cargarPeriodos();
            },
            error: (err: HttpErrorResponse) => {
              this.toastService.show(this.extraerMensajeError(err, 'No se pudo eliminar el periodo.'), 'error');
            }
          });
      }
    });
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}
