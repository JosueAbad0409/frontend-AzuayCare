import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { RevisionService } from '../../../core/services/revision.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { FichaRevision } from '../../../core/models/revision-ficha.model';
import { environment } from '../../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

Chart.register(...registerables);

export interface FiltrosDashboard {
  periodoId: string;
  carreraId: string;
  cicloId: string;
  etnia: string;
  sexo: string;
  zona: string;
  estadoFicha: string;
  nivelEconomico: string;
  busqueda: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly periodoService = inject(PeriodoService);
  private readonly revisionService = inject(RevisionService);
  private readonly formularioService = inject(FormularioService);

  isLoading = signal(true);
  isExporting = signal(false);
  periodoActivo = signal<PeriodoMatricula | null>(null);

  carrerasList = signal<Carrera[]>([]);
  ciclosList = signal<Ciclo[]>([]);
  periodosList = signal<PeriodoMatricula[]>([]);
  fichasList = signal<FichaRevision[]>([]);
  totalFormularios = signal(0);

  // --- Filtros demográficos ---
  filtrosPoblacion = signal({
    periodoId: '' as string,
    carreraId: '' as string,
    cicloId: '' as string,
    sexo: '' as string,
    etnia: '' as string,
    zona: '' as string,
    tieneDiscapacidad: '' as string,
    busqueda: '' as string,
  });

  resultadosPoblacion = signal<any[]>([]);
  cargandoPoblacion = signal(false);
  errorPoblacion = signal('');

  ciclosPoblacion = computed(() => {
    const carreraId = this.filtrosPoblacion().carreraId;
    const todos = this.ciclosList();
    if (!carreraId) return todos;

    return todos.filter((c) =>
      (c.ciclosCarreras || []).some(
        (cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId),
      ),
    );
  });

  setFiltroPoblacion(key: string, value: string) {
    this.filtrosPoblacion.update((prev) => {
      const next: any = { ...prev, [key]: value };
      if (key === 'carreraId') next.cicloId = '';
      return next;
    });
    this.buscarPoblacion();
  }

  limpiarFiltrosPoblacion() {
    const activo = this.periodoActivo();
    this.filtrosPoblacion.set({
      periodoId: activo?.id || '',
      carreraId: '',
      cicloId: '',
      sexo: '',
      etnia: '',
      zona: '',
      tieneDiscapacidad: '',
      busqueda: '',
    });
    this.buscarPoblacion();
  }

  private buildBodyPoblacion() {
    const f = this.filtrosPoblacion();
    const body: any = { vista: 'poblacion' };

    if (f.periodoId) body.periodo_id = f.periodoId;
    if (f.carreraId) body.carrera_id = f.carreraId;
    if (f.cicloId) body.ciclo_id = f.cicloId;
    if (f.sexo) body.sexo = f.sexo;
    if (f.etnia) body.etnia = f.etnia;
    if (f.zona) body.zona_residencia = f.zona;
    if (f.tieneDiscapacidad === 'true') body.tiene_discapacidad = true;
    if (f.tieneDiscapacidad === 'false') body.tiene_discapacidad = false;
    if (f.busqueda.trim()) body.busqueda = f.busqueda.trim();

    return body;
  }

  private authHeaders(): HeadersInit {
    const token = localStorage.getItem('azuaycare_access_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async buscarPoblacion() {
    this.cargandoPoblacion.set(true);
    this.errorPoblacion.set('');
    try {
      const res = await fetch(`${environment.apiUrl}/reportes/dataset-filtrado`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(this.buildBodyPoblacion()),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Error ${res.status}`);
      }
      const data = await res.json();
      this.resultadosPoblacion.set(Array.isArray(data) ? data : data?.datos || []);
    } catch (e: any) {
      this.errorPoblacion.set(e?.message || 'No se pudieron cargar los resultados.');
      this.resultadosPoblacion.set([]);
    } finally {
      this.cargandoPoblacion.set(false);
    }
  }

  private async descargarArchivo(url: string, nombre: string, titulo = 'Generando archivo...') {
    this.isExporting.set(true);
    Swal.fire({
      title: titulo,
      text: 'Esto puede tardar unos segundos. No cierres esta ventana.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(this.buildBodyPoblacion()),
      });
      if (!res.ok) throw new Error(await res.text() || `Error ${res.status}`);

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(a.href);

      await Swal.fire({
        icon: 'success',
        title: 'Listo',
        text: 'El archivo se descargó correctamente.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (e: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo generar',
        text: e?.message || 'Ocurrió un error al exportar.',
      });
    } finally {
      this.isExporting.set(false);
    }
  }

  async exportarPdfPoblacion() {
    await this.descargarArchivo(
      `${environment.apiUrl}/reportes/dataset-filtrado/pdf`,
      `Poblacion_${Date.now()}.pdf`,
      'Generando PDF...',
    );
  }

  async exportarExcelPoblacion() {
    try {
      await this.descargarArchivo(
        `${environment.apiUrl}/reportes/dataset-filtrado/excel`,
        `Poblacion_${Date.now()}.xlsx`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo exportar Excel');
    }
  }

  filtros = signal<FiltrosDashboard>({
    periodoId: '',
    carreraId: '',
    cicloId: '',
    etnia: '',
    sexo: '',
    zona: '',
    estadoFicha: '',
    nivelEconomico: '',
    busqueda: '',
  });

  readonly etnias = ['Mestizo/a', 'Indígena', 'Afroecuatoriano/a', 'Montubio/a', 'Blanco/a', 'Mulato/a', 'Otro'];
  readonly sexos = ['Hombre', 'Mujer'];
  readonly zonas = ['Urbano', 'Rural'];
  readonly estadosFicha = ['BORRADOR', 'ENVIADA', 'VALIDADO', 'RECHAZADO', 'OBSERVADO'];

  tipoGraficoCarrera = signal<'bar' | 'pie'>('bar');

  // ---- Canvas del HTML ----
  @ViewChild('carreraChartCanvas') carreraChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('estadoChartCanvas') estadoChartCanvas?: ElementRef<HTMLCanvasElement>;

  private carreraChart?: Chart;
  private estadoChart?: Chart;

  ciclosFiltrados = computed(() => {
    const carreraId = this.filtros().carreraId;
    const todos = this.ciclosList();
    if (!carreraId) return todos;
    return todos.filter((c) =>
      (c.ciclosCarreras || []).some((cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId)),
    );
  });

  nivelesDisponibles = computed(() => {
    const set = new Set<string>();
    this.fichasList().forEach((f) => {
      const n = f.nivelEconomico?.nombre;
      if (n) set.add(n);
    });
    return Array.from(set).sort();
  });

  /** Fichas con filtros aplicados */
  fichasFiltradas = computed(() => {
    const f = this.filtros();
    let list = this.fichasList() as any[];

    if (f.periodoId) {
      list = list.filter((x) => String(x.periodo_id) === String(f.periodoId) || String(x.periodo?.id) === String(f.periodoId));
    }
    if (f.carreraId) {
      list = list.filter((x) => {
        const carreraId = x.usuario?.carrera_id || x.usuario?.carrera?.id || x.carrera_id;
        return String(carreraId) === String(f.carreraId);
      });
    }
    if (f.cicloId) {
      list = list.filter((x) => {
        const cicloId = x.usuario?.ciclo_id || x.usuario?.ciclo?.id || x.ciclo_id;
        return String(cicloId) === String(f.cicloId);
      });
    }
    if (f.estadoFicha) {
      list = list.filter((x) => x.estado_ficha === f.estadoFicha);
    }
    if (f.nivelEconomico) {
      list = list.filter((x) => x.nivelEconomico?.nombre === f.nivelEconomico);
    }
    if (f.etnia) {
      list = list.filter((x) => x.usuario?.etnia === f.etnia || x.perfil?.etnia === f.etnia);
    }
    if (f.sexo) {
      list = list.filter((x) => x.usuario?.sexo === f.sexo || x.perfil?.sexo === f.sexo);
    }
    if (f.zona) {
      list = list.filter((x) => x.usuario?.zona_residencia === f.zona || x.perfil?.zona_residencia === f.zona);
    }
    if (f.busqueda.trim()) {
      const q = f.busqueda.trim().toLowerCase();
      list = list.filter((x) => {
        const u = x.usuario || {};
        const nombre = `${u.primer_nombre || ''} ${u.primer_apellido || ''}`.toLowerCase();
        const cedula = (u.cedula || '').toLowerCase();
        return nombre.includes(q) || cedula.includes(q);
      });
    }
    return list;
  });

// ===================== KPIs PRINCIPALES =====================
  
  totalFichas = computed(() => this.fichasFiltradas().length);
  
  // 🔥 Solo cuenta las carreras que realmente tienen fichas en este periodo
  totalCarreras = computed(() => {
    const carrerasConFichas = new Set(
      this.fichasFiltradas()
        .map((f) => f.usuario?.carrera_id || f.usuario?.carrera?.id || f.carrera_id)
        .filter(id => !!id)
    );
    return carrerasConFichas.size;
  });
  
  fichasEnviadas = computed(() => this.fichasFiltradas().filter((f) => {
    const e = (f.estado_ficha || '').toUpperCase();
    return e === 'ENVIADA' || e === 'ENVIADO';
  }).length);

  fichasValidadas = computed(() => this.fichasFiltradas().filter((f) => 
    (f.estado_ficha || '').toUpperCase() === 'VALIDADO'
  ).length);

  fichasRechazadas = computed(() => this.fichasFiltradas().filter((f) => {
    const e = (f.estado_ficha || '').toUpperCase();
    return e === 'RECHAZADO' || e === 'RECHAZADA' || e === 'OBSERVADO';
  }).length);

  fichasBorrador = computed(() => this.fichasFiltradas().filter((f) => 
    (f.estado_ficha || '').toUpperCase() === 'BORRADOR'
  ).length);

  // 🔥 CORRECCIÓN: Las evaluadas son SOLO las validadas, rechazadas u observadas
  totalFichasEvaluadas = computed(() => {
    return this.fichasFiltradas().filter((f) => {
      const e = (f.estado_ficha || '').toUpperCase();
      return e === 'VALIDADO' || e === 'RECHAZADO' || e === 'OBSERVADO';
    }).length;
  });

  // 🔥 AHORA SÍ: Contamos alertas EXCLUYENDO los borradores, igual que hace el backend
  totalNee = computed(() => {
    return this.fichasFiltradas().filter((f: any) => 
      f.total_alertas > 0 && (f.estado_ficha || '').toUpperCase() !== 'BORRADOR'
    ).length;
  });

  hayFiltrosActivos = computed(() => {
    const f = this.filtros();
    return !!(f.carreraId || f.cicloId || f.etnia || f.sexo || f.zona || f.estadoFicha || f.nivelEconomico || f.busqueda);
  });

// 🔥 Muestra las condiciones con iconos y barras relativas para un look profesional
  condiciones = computed(() => {
    const map = new Map<string, number>();
    const bump = (nombre: string) => map.set(nombre, (map.get(nombre) || 0) + 1);

    this.fichasFiltradas().forEach((f: any) => {
      const p = f.perfil || {};
      
      if (p.tiene_discapacidad === true) bump('Discapacidad Registrada');
      if (p.esta_embarazada === true) bump('Embarazo / Maternidad');
      if (p.tiene_hijos === true) bump('Con Dependientes (Hijos/as)');
      if (f.total_alertas && f.total_alertas > 0 && (f.estado_ficha || '').toUpperCase() !== 'BORRADOR') {
        bump('Alertas Socioeconómicas Altas');
      }
    });

    // Convertimos el mapa en arreglo y le asignamos iconos según el nombre
    let list = Array.from(map.entries()).map(([nombre, total]) => {
      let icon = 'fa-exclamation-circle'; // Icono por defecto
      let colorClass = '#64748b'; // Color gris por defecto

      if (nombre.includes('Discapacidad')) { icon = 'fa-wheelchair'; colorClass = '#3b82f6'; } // Azul
      else if (nombre.includes('Embarazo')) { icon = 'fa-baby'; colorClass = '#ec4899'; } // Rosa
      else if (nombre.includes('Dependientes')) { icon = 'fa-children'; colorClass = '#10b981'; } // Verde
      else if (nombre.includes('Alertas')) { icon = 'fa-shield-alt'; colorClass = '#f43f5e'; } // Rojo

      return { nombre, total, icon, colorClass };
    }).sort((a, b) => b.total - a.total);

    // Encontramos el valor máximo para que la barra más grande siempre sea del 100% visualmente
    const maxVal = list.length > 0 ? list[0].total : 1;

    return list.map(item => ({
      ...item,
      // Esto es solo para el ancho de la barra de progreso (diseño)
      anchoBarra: Math.round((item.total / maxVal) * 100) 
    }));
  });

  constructor() {
    afterNextRender(() => {
      if (!this.isLoading()) this.inicializarGraficos();
    });
  }

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen(): void {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras(),
      ciclos: this.ciclosService.getCiclos(),
      fichas: this.revisionService.getTodasLasFichas(),
      periodos: this.periodoService.getPeriodos(),
      formularios: this.formularioService.getFormularios(),
    }).subscribe({
      next: ({ carreras, ciclos, fichas, periodos, formularios }: any) => {
        this.carrerasList.set((carreras || []).filter((c: Carrera) => !c.fecha_desactivacion));
        this.ciclosList.set(
          (ciclos || [])
            .filter((c: Ciclo) => !c.fecha_desactivacion)
            .map((c: any) => {
              if (c.carreras) return c;
              if (c.ciclosCarreras) {
                return {
                  ...c,
                  carreras: c.ciclosCarreras.map((cc: any) => cc.carrera || { id: cc.carrera_id, nombre: '—' }).filter(Boolean),
                };
              }
              return { ...c, carreras: [] };
            })
        );
        
        // 🔥 ESTA LÍNEA ES LA MAGIA QUE ARREGLA LAS TARJETAS (Extrae el array real si viene paginado)
        const arregloFichas = Array.isArray(fichas) ? fichas : (fichas?.data || []);
        this.fichasList.set(arregloFichas);
        
        this.periodosList.set(periodos || []);
        this.totalFormularios.set(formularios?.length || 0);

        const activo = (periodos || []).find((p: any) => p.activo);
        if (activo) {
          this.periodoActivo.set(activo);
          this.filtros.update((prev) => ({ ...prev, periodoId: activo.id }));
          this.filtrosPoblacion.update((prev) => ({ ...prev, periodoId: activo.id }));
        }

        this.isLoading.set(false);
        setTimeout(() => this.inicializarGraficos(), 80);
        this.buscarPoblacion();
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard:', err);
        this.isLoading.set(false);
      },
    });
  }

  setFiltro<K extends keyof FiltrosDashboard>(key: K, value: FiltrosDashboard[K]): void {
    this.filtros.update((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'carreraId') next.cicloId = '';
      return next;
    });
    setTimeout(() => this.inicializarGraficos(), 30);
  }

  limpiarFiltros(): void {
    const activo = this.periodoActivo();
    this.filtros.set({
      periodoId: activo?.id || '',
      carreraId: '',
      cicloId: '',
      etnia: '',
      sexo: '',
      zona: '',
      estadoFicha: '',
      nivelEconomico: '',
      busqueda: '',
    });
    setTimeout(() => this.inicializarGraficos(), 30);
  }

  pctCondicion(total: number): number {
    const base = this.fichasFiltradas().length || 1;
    return Math.round((total / base) * 100);
  }

  nombreEstudiante(f: any): string {
    const u = f.usuario || {};
    return `${u.primer_nombre || ''} ${u.primer_apellido || ''}`.trim() || 'Sin nombre';
  }

  cedulaEstudiante(f: any): string {
    return f.usuario?.cedula || '—';
  }

  carreraEstudiante(f: any): string {
    return (
      f.usuario?.carrera?.nombre ||
      this.carrerasList().find((c) => c.id === f.usuario?.carrera_id)?.nombre ||
      '—'
    );
  }

  cicloEstudiante(f: any): string {
    return (
      f.usuario?.ciclo?.nombre ||
      this.ciclosList().find((c) => c.id === f.usuario?.ciclo_id)?.nombre ||
      '—'
    );
  }

  cambiarTipoGrafico(_cual: string, tipo: 'bar' | 'pie'): void {
    this.tipoGraficoCarrera.set(tipo);
    setTimeout(() => this.inicializarGraficos(), 30);
  }

  // ===================== GRÁFICOS =====================

  inicializarGraficos(): void {
    const fichas = this.fichasFiltradas() as any[];
    const carreras = this.carrerasList();

    this.renderCarreraChart(fichas, carreras);
    this.renderEstadoChart(fichas);
  }

  private renderCarreraChart(fichas: any[], carreras: Carrera[]): void {
    if (!this.carreraChartCanvas) return;

    const labels: string[] = [];
    const enviadas: number[] = [];
    const validadas: number[] = [];
    const borradores: number[] = []; // 🔥 Agregamos el arreglo para los borradores

    const carreraFiltro = this.filtros().carreraId;
    const lista = carreraFiltro
      ? carreras.filter((c) => String(c.id) === String(carreraFiltro))
      : carreras;

    const esEnviada = (estado: string | undefined) => {
      const e = (estado || '').toUpperCase();
      return e === 'ENVIADA' || e === 'ENVIADO';
    };

    const esValidada = (estado: string | undefined) => {
      return (estado || '').toUpperCase() === 'VALIDADO';
    };

    const esBorrador = (estado: string | undefined) => {
      return (estado || '').toUpperCase() === 'BORRADOR';
    };

    lista.forEach((carrera) => {
      labels.push(carrera.nombre);

      const deCarrera = fichas.filter((x) => {
        const carreraId = x.usuario?.carrera_id || x.usuario?.carrera?.id || x.carrera_id;
        return String(carreraId) === String(carrera.id);
      });

      enviadas.push(deCarrera.filter((x) => esEnviada(x.estado_ficha)).length);
      validadas.push(deCarrera.filter((x) => esValidada(x.estado_ficha)).length);
      borradores.push(deCarrera.filter((x) => esBorrador(x.estado_ficha)).length); // 🔥 Contamos los borradores
    });

    const ctx = this.carreraChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.carreraChart?.destroy();

    const tipo = this.tipoGraficoCarrera();
    // Validamos si hay datos en cualquiera de los 3 estados
    const hayDatos = enviadas.some((n) => n > 0) || validadas.some((n) => n > 0) || borradores.some((n) => n > 0);

    if (tipo === 'pie') {
      const totales = labels.map((_, i) => enviadas[i] + validadas[i] + borradores[i]);
      this.carreraChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels.length && hayDatos ? labels : ['Sin datos'],
          datasets: [
            {
              data: hayDatos ? totales : [1],
              backgroundColor: hayDatos
                ? ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b']
                : ['#e2e8f0'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } },
        },
      });
    } else {
      this.carreraChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Sin carreras'],
          datasets: [
            // 🔥 Nueva barra naranja para las fichas "Por Completar"
            {
              label: 'Por Completar',
              data: borradores.length ? borradores : [0],
              backgroundColor: '#f59e0b', 
              borderRadius: 6,
            },
            {
              label: 'Por Validar',
              data: enviadas.length ? enviadas : [0],
              backgroundColor: '#8b5cf6',
              borderRadius: 6,
            },
            {
              label: 'Validadas',
              data: validadas.length ? validadas : [0],
              backgroundColor: '#10b981',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true } },
            tooltip: {
              callbacks: {
                footer: (items) => {
                  const i = items[0]?.dataIndex ?? 0;
                  // Sumamos los 3 para que el total en el tooltip cuadre perfecto
                  const total = (enviadas[i] || 0) + (validadas[i] || 0) + (borradores[i] || 0);
                  return `Total: ${total}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                maxRotation: 45,
                minRotation: 0,
                autoSkip: true,
                callback: function (value) {
                  const label = this.getLabelForValue(value as number) || '';
                  return label.length > 18 ? label.slice(0, 16) + '…' : label;
                },
              },
            },
            y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 } },
          },
        },
      });
    }
  }

  private renderEstadoChart(fichas: any[]): void {
    if (!this.estadoChartCanvas) return;

    // 🔥 Separé los estados de la base de datos de los nombres bonitos que queremos ver
    const estadosBD = ['BORRADOR', 'ENVIADA', 'VALIDADO', 'RECHAZADO', 'OBSERVADO'];
    const nombresAmigables = ['Por Completar', 'Enviadas', 'Validadas', 'Rechazadas', 'Observadas'];
    const colores = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#64748b'];
    
    const data = estadosBD.map((e) => fichas.filter((f) => f.estado_ficha === e).length);

    const ctx = this.estadoChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.estadoChart?.destroy();

    this.estadoChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: nombresAmigables, // Usamos los nombres bonitos
        datasets: [{ data, backgroundColor: colores, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12 } } },
      },
    });
  }

  // ===================== EXPORT =====================
  private buildFiltroBody() {
    const f = this.filtros();
    return {
      periodo_id: f.periodoId || this.periodoActivo()?.id || undefined,
      carrera_id: f.carreraId || undefined,
      ciclo_id: f.cicloId || undefined,
      etnia: f.etnia || undefined,
      sexo: f.sexo || undefined,
      zona_residencia: f.zona || undefined,
      estado_ficha: f.estadoFicha || undefined,
      nivel_economico: f.nivelEconomico || undefined,
    };
  }

  private async descargarBlob(url: string, options: RequestInit, nombreArchivo: string) {
    this.isExporting.set(true);
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status} al descargar`);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nombreArchivo;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      this.isExporting.set(false);
    }
  }

  async descargarReporteExcel(): Promise<void> {
    const periodo = this.filtros().periodoId || this.periodoActivo()?.id;
    if (!periodo) {
      alert('Selecciona un periodo para exportar el Excel.');
      return;
    }
    try {
      await this.descargarBlob(
        `${environment.apiUrl}/reportes/socioeconomico/periodo/${periodo}`,
        { method: 'GET', headers: this.authHeaders() },
        `Matriz_Socioeconomica_${periodo}.xlsx`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo descargar el Excel.');
    }
  }

  async descargarReportePdf(): Promise<void> {
    const periodo = this.filtros().periodoId || this.periodoActivo()?.id;
    if (!periodo) {
      alert('Selecciona un periodo para exportar el PDF.');
      return;
    }
    try {
      await this.descargarBlob(
        `${environment.apiUrl}/reportes/dataset-filtrado/pdf`,
        { method: 'POST', headers: this.authHeaders(), body: JSON.stringify(this.buildFiltroBody()) },
        `Reporte_Filtrado_${Date.now()}.pdf`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo descargar el PDF.');
    }
  }

  async descargarExcelFiltrado(): Promise<void> {
    try {
      await this.descargarBlob(
        `${environment.apiUrl}/reportes/dataset-filtrado/excel`,
        { method: 'POST', headers: this.authHeaders(), body: JSON.stringify(this.buildFiltroBody()) },
        `Reporte_Filtrado_${Date.now()}.xlsx`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo descargar el Excel filtrado.');
    }
  }
}