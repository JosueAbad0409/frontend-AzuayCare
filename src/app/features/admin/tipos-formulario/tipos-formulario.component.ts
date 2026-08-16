import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { TipoFormularioService } from '../../../core/services/tipo-formulario.service';
import { ToastService } from '../../../core/services/toast.service';
import { TipoFormulario } from '../../../core/models/tipo-formulario.model';

@Component({
  selector: 'app-tipos-formulario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tipos-formulario.component.html',
  styleUrls: ['./tipos-formulario.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TiposFormularioComponent implements OnInit, OnDestroy {
  private readonly tipoFormularioService = inject(TipoFormularioService);
  private readonly toastService = inject(ToastService);

  readonly tipos = signal<TipoFormulario[]>([]);
  readonly loading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly filterNombre = signal<string>('');
  readonly filterDescripcion = signal<string>('');

  private readonly filterSubject = new Subject<{ campo: string; valor: string }>();
  private filterSubscription?: Subscription;

  private readonly SWAL_CUSTOM_CLASS = {
    popup: 'custom-swal-popup',
    confirmButton: 'custom-swal-confirm',
    cancelButton: 'custom-swal-cancel',
    htmlContainer: 'custom-swal-html'
  };

  readonly ICON_LIBRARY: Record<string, string[]> = {
    'General': ['fa-star', 'fa-home', 'fa-cog', 'fa-bell', 'fa-calendar-alt', 'fa-flag', 'fa-check-circle', 'fa-info-circle'],
    'Archivos': ['fa-file-alt', 'fa-file', 'fa-folder', 'fa-folder-open', 'fa-clipboard-list', 'fa-paperclip', 'fa-archive', 'fa-copy'],
    'Finanzas': ['fa-wallet', 'fa-money-bill-wave', 'fa-coins', 'fa-piggy-bank', 'fa-credit-card', 'fa-receipt', 'fa-chart-line', 'fa-dollar-sign'],
    'Salud': ['fa-heartbeat', 'fa-stethoscope', 'fa-pills', 'fa-user-md', 'fa-hospital', 'fa-ambulance', 'fa-first-aid', 'fa-notes-medical'],
    'Educación': ['fa-graduation-cap', 'fa-school', 'fa-book', 'fa-book-open', 'fa-user-graduate', 'fa-chalkboard-teacher', 'fa-laptop-code'],
    'Usuarios': ['fa-user', 'fa-users', 'fa-id-card', 'fa-address-card', 'fa-user-tie', 'fa-user-shield', 'fa-hands-helping'],
    'Servicios': ['fa-bolt', 'fa-wifi', 'fa-bus', 'fa-car', 'fa-utensils', 'fa-shopping-cart', 'fa-tools']
  };

  readonly tieneFiltrosActivos = computed(() => {
    return !!(this.filterNombre() || this.filterDescripcion());
  });

  private normalizarTexto(texto: string | null | undefined): string {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  readonly tiposFiltrados = computed(() => {
    const fNombre = this.normalizarTexto(this.filterNombre());
    const fDesc = this.normalizarTexto(this.filterDescripcion());
    const lista = this.tipos();

    return lista.filter(t => {
      if (fNombre && !this.normalizarTexto(t.nombre).includes(fNombre)) {
        return false;
      }
      if (fDesc) {
        const desc = this.normalizarTexto(t.descripcion);
        if (!desc.includes(fDesc)) return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.filterSubscription = this.filterSubject
      .pipe(debounceTime(400))
      .subscribe(({ campo, valor }) => {
        if (campo === 'nombre') this.filterNombre.set(valor);
        if (campo === 'descripcion') this.filterDescripcion.set(valor);
      });

    this.cargarTipos();
  }

  ngOnDestroy(): void {
    this.filterSubscription?.unsubscribe();
  }

  onColumnFilterInput(campo: string, event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.filterSubject.next({ campo, valor });
  }

  limpiarFiltros(): void {
    this.filterNombre.set('');
    this.filterDescripcion.set('');
  }

  cargarTipos(): void {
    this.loading.set(true);
    this.tipoFormularioService.getTiposFormulario()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.tipos.set(data || []),
        error: (err: HttpErrorResponse) => {
          console.error('Error al cargar tipos de formulario:', err);
          this.toastService.show('Error al cargar los tipos de formulario.', 'error');
        }
      });
  }

  abrirFormularioSwal(tipo?: TipoFormulario): void {
    if (this.isSaving()) return;

    const isEditing = !!tipo;
    const titleText = isEditing ? 'Editar Tipo de Formulario' : 'Nuevo Tipo de Formulario';
    const confirmText = isEditing ? '<i class="fas fa-sync-alt"></i> Actualizar Registro' : '<i class="fas fa-plus-circle"></i> Crear Registro';

    let iconoSeleccionado = isEditing ? (tipo.icono || 'fa-file-alt') : 'fa-file-alt';
    let colorSeleccionado = isEditing ? (tipo.color || '#8b5cf6') : '#8b5cf6';
    let categoriaActiva = 'Todos';

    const renderTabs = () => {
      const categorias = ['Todos', ...Object.keys(this.ICON_LIBRARY)];
      return categorias.map(cat => `
        <button type="button" class="icon-tab ${cat === categoriaActiva ? 'active' : ''}" data-cat="${cat}">${cat}</button>
      `).join('');
    };

    const renderGrid = (categoria: string) => {
      let iconosAMostrar: string[] = [];
      if (categoria === 'Todos') {
        iconosAMostrar = Object.values(this.ICON_LIBRARY).flat();
      } else {
        iconosAMostrar = this.ICON_LIBRARY[categoria] || [];
      }

      return iconosAMostrar.map(iconClass => `
        <button type="button" class="icon-grid-btn ${iconClass === iconoSeleccionado ? 'selected' : ''}" data-icon="${iconClass}" title="${iconClass}">
          <i class="fas ${iconClass}"></i>
        </button>
      `).join('');
    };

    Swal.fire({
      title: titleText,
      width: '92%',
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner banner-purple">
            <div class="banner-icon icon-purple" id="swal-preview-box" style="background-color: ${colorSeleccionado}20; color: ${colorSeleccionado}">
              <i class="fas ${iconoSeleccionado}" id="swal-preview-icon"></i>
            </div>
            <div>
              <div class="banner-title">Configuración de Ficha</div>
              <div class="banner-sub">Personaliza los identificadores visuales de esta categoría.</div>
            </div>
          </div>

          <div class="swal-form-group">
            <label class="swal-form-label" for="swal-nombre">Nombre del Tipo <span class="req">*</span></label>
            <input id="swal-nombre" type="text" class="swal-form-control" placeholder="Ej. Ficha Socioeconómica" value="${isEditing ? tipo.nombre : ''}">
          </div>

          <div class="swal-form-group">
            <label class="swal-form-label" for="swal-descripcion">Descripción Institucional</label>
            <textarea id="swal-descripcion" class="swal-form-control textarea-styled" placeholder="Objetivo o alcance de esta ficha...">${isEditing ? (tipo.descripcion || '') : ''}</textarea>
          </div>

          <div class="swal-form-group">
            <label class="swal-form-label" for="swal-color">Color Distintivo</label>
            <div class="color-input-wrap">
              <input id="swal-color" type="color" class="color-picker-input" value="${colorSeleccionado}">
              <span class="color-hex-label" id="swal-color-label">${colorSeleccionado}</span>
            </div>
          </div>

          <div class="swal-form-group icon-section-container">
            <label class="swal-form-label">Librería de Íconos</label>
            <input id="swal-icono-val" type="hidden" value="${iconoSeleccionado}">
            
            <div class="tabs-scroll-wrapper">
              <button type="button" class="scroll-arrow arrow-left" id="swal-scroll-left" aria-label="Desplazar a la izquierda">
                <i class="fas fa-chevron-left"></i>
              </button>
              <div class="icon-tabs-scroll" id="swal-icon-tabs">
                ${renderTabs()}
              </div>
              <button type="button" class="scroll-arrow arrow-right" id="swal-scroll-right" aria-label="Desplazar a la derecha">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
            
            <div class="icon-grid-sections" id="swal-icon-grid">
              ${renderGrid('Todos')}
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      customClass: this.SWAL_CUSTOM_CLASS,
      didOpen: () => {
        const popup = Swal.getPopup();
        if (!popup) return;

        const tabsContainer = popup.querySelector('#swal-icon-tabs') as HTMLElement;
        const gridContainer = popup.querySelector('#swal-icon-grid') as HTMLElement;
        const hiddenVal = popup.querySelector('#swal-icono-val') as HTMLInputElement;
        
        const btnScrollLeft = popup.querySelector('#swal-scroll-left') as HTMLButtonElement;
        const btnScrollRight = popup.querySelector('#swal-scroll-right') as HTMLButtonElement;

        const colorInput = popup.querySelector('#swal-color') as HTMLInputElement;
        const colorLabel = popup.querySelector('#swal-color-label') as HTMLElement;
        const previewBox = popup.querySelector('#swal-preview-box') as HTMLElement;
        const previewIcon = popup.querySelector('#swal-preview-icon') as HTMLElement;

        btnScrollLeft?.addEventListener('click', () => {
          tabsContainer.scrollBy({ left: -140, behavior: 'smooth' });
        });

        btnScrollRight?.addEventListener('click', () => {
          tabsContainer.scrollBy({ left: 140, behavior: 'smooth' });
        });

        colorInput?.addEventListener('input', (e) => {
          colorSeleccionado = (e.target as HTMLInputElement).value;
          if (colorLabel) colorLabel.textContent = colorSeleccionado;
          if (previewBox) {
            previewBox.style.backgroundColor = `${colorSeleccionado}20`;
            previewBox.style.color = colorSeleccionado;
          }
        });

        const bindGridEvents = () => {
          gridContainer?.querySelectorAll('.icon-grid-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const iconClass = btn.getAttribute('data-icon') || 'fa-file-alt';
              iconoSeleccionado = iconClass;
              if (hiddenVal) hiddenVal.value = iconClass;
              if (previewIcon) previewIcon.className = `fas ${iconClass}`;

              gridContainer.querySelectorAll('.icon-grid-btn').forEach(i => i.classList.remove('selected'));
              btn.classList.add('selected');
            });
          });
        };

        tabsContainer?.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('icon-tab')) {
            categoriaActiva = target.getAttribute('data-cat') || 'Todos';
            
            tabsContainer.querySelectorAll('.icon-tab').forEach(t => t.classList.remove('active'));
            target.classList.add('active');

            gridContainer.innerHTML = renderGrid(categoriaActiva);
            bindGridEvents();
          }
        });

        bindGridEvents();
      },
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value.trim();
        const descripcion = (document.getElementById('swal-descripcion') as HTMLTextAreaElement).value.trim();
        const icono = (document.getElementById('swal-icono-val') as HTMLInputElement).value.trim() || 'fa-file-alt';
        const color = (document.getElementById('swal-color') as HTMLInputElement).value;

        if (!nombre) {
          Swal.showValidationMessage('El nombre es obligatorio.');
          return false;
        }

        return { nombre, descripcion, icono, color };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarTipoEnDb(result.value, isEditing ? tipo.id : null);
      }
    });
  }

  guardarTipoEnDb(formData: any, id: string | null): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const peticion$ = id
      ? this.tipoFormularioService.updateTipoFormulario(id, formData)
      : this.tipoFormularioService.createTipoFormulario(formData);

    peticion$
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show(
            id ? 'Tipo de formulario actualizado con éxito.' : 'Tipo de formulario registrado con éxito.',
            'success'
          );
          this.cargarTipos();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al guardar tipo de formulario:', err);
          this.toastService.show(this.extraerMensajeError(err, 'Error al guardar el registro.'), 'error');
        }
      });
  }

  eliminarTipo(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Deseas eliminar este tipo de formulario? Solo será posible si no tiene formularios activos asociados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, eliminar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.tipoFormularioService.deleteTipoFormulario(id)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Tipo de formulario desactivado con éxito.', 'info');
              this.cargarTipos();
            },
            error: (err: HttpErrorResponse) => {
              console.error('Error al desactivar:', err);
              this.toastService.show(this.extraerMensajeError(err, 'No se pudo desactivar el tipo de formulario.'), 'error');
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