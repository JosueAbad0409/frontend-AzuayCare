import {
  Component,
  OnInit,
  OnDestroy,
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
import { AuthService } from '../../../core/services/auth.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { FichaRevision } from '../../../core/models/revision-ficha.model';
import { Formulario } from '../../../core/models/formulario.model';
import { environment } from '../../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';

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
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly periodoService = inject(PeriodoService);
  private readonly revisionService = inject(RevisionService);
  private readonly formularioService = inject(FormularioService);
  private readonly authService = inject(AuthService);

  isLoading = signal(true);
  periodoActivo = signal<PeriodoMatricula | null>(null);

  carrerasList = signal<Carrera[]>([]);
  ciclosList = signal<Ciclo[]>([]);
  periodosList = signal<PeriodoMatricula[]>([]);
  fichasList = signal<FichaRevision[]>([]);
  formulariosList = signal<Formulario[]>([]);

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
    this.filtrosPoblacion.set({
      periodoId: this.periodoActivo()?.id || '',
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
  readonly estadosFicha = ['BORRADOR', 'ENVIADA', 'POR VALIDAR', 'VALIDADO', 'RECHAZADO', 'OBSERVADO'];

  tipoGraficoCarrera = signal<'bar' | 'pie'>('bar');

  @ViewChild('carreraChartCanvas') carreraChartCanvas?: ElementRef<HTMLCanvasElement>;
  private carreraChart?: Chart;

  ciclosFiltrados = computed(() => {
    const carreraId = this.filtros().carreraId;
    const todos = this.ciclosList();
    if (!carreraId) return todos;
    return todos.filter((c) =>
      (c.ciclosCarreras || []).some((cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId)),
    );
  });

  /**
   * Normaliza el estado de la ficha
   */
  private obtenerEstadoNormalizado(f: any): string {
    const e = String(f.estado_ficha || f.estado || '').toUpperCase().trim();
    if (e === 'ENVIADO' || e === 'ENVIADA' || e === 'POR VALIDAR' || e === 'POR_VALIDAR') {
      return 'POR VALIDAR';
    }
    if (e === 'VALIDADO' || e === 'VALIDADA' || e === 'APROBADO' || e === 'APROBADA') {
      return 'VALIDADO';
    }
    if (e === 'RECHAZADO' || e === 'RECHAZADA' || e === 'OBSERVADO' || e === 'OBSERVADA') {
      return 'RECHAZADO';
    }
    if (e === 'BORRADOR') {
      return 'BORRADOR';
    }
    return e;
  }

  /** Fichas filtradas dinámicamente */
  fichasFiltradas = computed(() => {
    const f = this.filtros();
    let list = this.fichasList() as any[];

    if (f.periodoId) {
      list = list.filter((x) => {
        const pId = String(x.periodo_id || x.periodo?.id || '');
        const pNombre = String(x.periodo_nombre || x.periodo?.nombre || x.periodo || '');
        const filtroVal = String(f.periodoId);

        return pId === filtroVal || pNombre === filtroVal;
      });
    }

    if (f.carreraId) {
      list = list.filter((x) => {
        const carreraId = x.usuario?.carrera_id || x.usuario?.carrera?.id || x.carrera_id || x.carrera?.id;
        return String(carreraId) === String(f.carreraId);
      });
    }

    if (f.cicloId) {
      list = list.filter((x) => {
        const cicloId = x.usuario?.ciclo_id || x.usuario?.ciclo?.id || x.ciclo_id || x.ciclo?.id;
        return String(cicloId) === String(f.cicloId);
      });
    }

    if (f.estadoFicha) {
      const target = f.estadoFicha.toUpperCase();
      list = list.filter((x) => {
        const est = this.obtenerEstadoNormalizado(x);
        if (target === 'POR VALIDAR' || target === 'ENVIADA') {
          return est === 'POR VALIDAR';
        }
        return est === target;
      });
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
        const nombre = `${u.primer_nombre || ''} ${u.primer_apellido || ''} ${x.estudiante || ''}`.toLowerCase();
        const cedula = (u.cedula || x.cedula || '').toLowerCase();
        return nombre.includes(q) || cedula.includes(q);
      });
    }

    return list;
  });

  // ===================== KPIs PRINCIPALES =====================
  totalFichas = computed(() => this.fichasFiltradas().length);

  // 🔥 CORREGIDO: Cuenta solo las carreras que tienen fichas en las fichas filtradas
  totalCarreras = computed(() => {
    const carrerasConFichas = new Set(
      this.fichasFiltradas()
        .map((f) => f.usuario?.carrera_id || f.usuario?.carrera?.id || f.carrera_id || f.carrera?.id)
        .filter((id) => !!id)
    );
    return carrerasConFichas.size;
  });

  // 🔥 CORREGIDO: Cuenta únicamente los formularios pertenecientes al periodo seleccionado
  totalFormularios = computed(() => {
    const f = this.filtros();
    const pId = f.periodoId || this.periodoActivo()?.id;

    if (!pId) return this.formulariosList().length;

    return this.formulariosList().filter((form: any) => {
      const formPeriodoId = String(form.periodo_id || form.periodo?.id || '');
      return formPeriodoId === String(pId);
    }).length;
  });

  fichasEnviadas = computed(() =>
    this.fichasFiltradas().filter((f) => this.obtenerEstadoNormalizado(f) === 'POR VALIDAR').length
  );

  fichasValidadas = computed(() =>
    this.fichasFiltradas().filter((f) => this.obtenerEstadoNormalizado(f) === 'VALIDADO').length
  );

  fichasRechazadas = computed(() =>
    this.fichasFiltradas().filter((f) => this.obtenerEstadoNormalizado(f) === 'RECHAZADO').length
  );

  fichasBorrador = computed(() =>
    this.fichasFiltradas().filter((f) => this.obtenerEstadoNormalizado(f) === 'BORRADOR').length
  );

  /** Casos vulnerables / Prioridad / NEE */
  totalNee = computed(() => {
    return this.fichasFiltradas().filter((f: any) => {
      const tieneAlertas = (f.total_alertas && Number(f.total_alertas) > 0) || 
                           (f.detalles_vulnerabilidad && Object.keys(f.detalles_vulnerabilidad).length > 0) ||
                           f.tiene_discapacidad || f.perfil?.tiene_discapacidad ||
                           f.esta_embarazada || f.perfil?.esta_embarazada ||
                           f.tiene_hijos || f.perfil?.tiene_hijos;

      const estadoValido = this.obtenerEstadoNormalizado(f) !== 'BORRADOR';
      return tieneAlertas && estadoValido;
    }).length;
  });

  hayFiltrosActivos = computed(() => {
    const f = this.filtros();
    const pActivoId = this.periodoActivo()?.id || this.periodoActivo()?.nombre || '';
    const periodoCambiado = f.periodoId ? String(f.periodoId) !== String(pActivoId) : false;

    return !!(periodoCambiado || f.carreraId || f.cicloId || f.etnia || f.sexo || f.zona || f.estadoFicha || f.nivelEconomico || f.busqueda);
  });

  condiciones = computed(() => {
    const map = new Map<string, number>();
    const bump = (nombre: string) => map.set(nombre, (map.get(nombre) || 0) + 1);

    this.fichasFiltradas().forEach((f: any) => {
      const p = f.perfil || {};
      const det = f.detalles_vulnerabilidad || {};

      let detectado = false;

      if (p.tiene_discapacidad === true || f.tiene_discapacidad === true || det['DISCAPACIDAD'] || det['¿POSEE ALGUNA DISCAPACIDAD?']) {
        bump('Discapacidad Registrada');
        detectado = true;
      }
      if (p.esta_embarazada === true || f.esta_embarazada === true || det['EMBARAZO']) {
        bump('Embarazo / Maternidad');
        detectado = true;
      }
      if (p.tiene_hijos === true || f.tiene_hijos === true || det['HIJOS']) {
        bump('Con Dependientes (Hijos/as)');
        detectado = true;
      }

      const llaves = Object.keys(det);
      if (llaves.length > 0) {
        llaves.forEach((k) => {
          const keyUpper = k.toUpperCase();
          if (!keyUpper.includes('DISCAPACIDAD') && !keyUpper.includes('EMBARAZO') && !keyUpper.includes('HIJOS')) {
            bump('Atención de Salud / Alergias / Patologías');
            detectado = true;
          }
        });
      }

      if (!detectado && (f.total_alertas && Number(f.total_alertas) > 0) && this.obtenerEstadoNormalizado(f) !== 'BORRADOR') {
        bump('Alertas Socioeconómicas Altas');
      }
    });

    let list = Array.from(map.entries())
      .map(([nombre, total]) => {
        let icon = 'fa-exclamation-circle';
        let colorClass = '#64748b';

        if (nombre.includes('Discapacidad')) {
          icon = 'fa-wheelchair';
          colorClass = '#3b82f6';
        } else if (nombre.includes('Embarazo')) {
          icon = 'fa-baby';
          colorClass = '#ec4899';
        } else if (nombre.includes('Dependientes')) {
          icon = 'fa-children';
          colorClass = '#10b981';
        } else if (nombre.includes('Salud') || nombre.includes('Alertas')) {
          icon = 'fa-shield-alt';
          colorClass = '#f43f5e';
        }

        return { nombre, total, icon, colorClass };
      })
      .sort((a, b) => b.total - a.total);

    const maxVal = list.length > 0 ? list[0].total : 1;

    return list.map((item) => ({
      ...item,
      anchoBarra: Math.round((item.total / maxVal) * 100),
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

  ngOnDestroy(): void {
    this.carreraChart?.destroy();
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
        const user: any = this.authService.user();
        
        let arregloFichas: any[] = Array.isArray(fichas) ? fichas : (fichas?.data || []);

        const rolStr = typeof user?.rol === 'string' ? user.rol : JSON.stringify(user?.rol || '');
        if (rolStr.includes('COORDINADOR_CARRERA')) {
          const carrerasUsuario = user?.carrerasCoordinadas || (user?.carrera ? [user.carrera] : []);
          if (carrerasUsuario.length > 0) {
            const nombres: string[] = carrerasUsuario.map((c: any) => (c.nombre || c || '').toLowerCase().trim());
            const ids: string[] = carrerasUsuario.map((c: any) => String(c.id || c));

            arregloFichas = arregloFichas.filter((f) => {
              const fCarreraId = String(f.carrera_id || f.usuario?.carrera_id || f.usuario?.carrera?.id || '');
              const fCarreraNombre = (f.carrera || f.usuario?.carrera?.nombre || '').toLowerCase().trim();
              
              return ids.includes(fCarreraId) || nombres.some((n: string) => fCarreraNombre.includes(n) || n.includes(fCarreraNombre));
            });
          }
        }

        this.carrerasList.set((carreras || []).filter((c: Carrera) => !c.fecha_desactivacion));
        this.ciclosList.set(
          (ciclos || [])
            .filter((c: Ciclo) => !c.fecha_desactivacion)
            .map((c: any) => {
              if (c.carreras) return c;
              if (c.ciclosCarreras) {
                return {
                  ...c,
                  carreras: c.ciclosCarreras
                    .map((cc: any) => cc.carrera || { id: cc.carrera_id, nombre: '—' })
                    .filter(Boolean),
                };
              }
              return { ...c, carreras: [] };
            })
        );

        this.fichasList.set(arregloFichas);
        this.periodosList.set(periodos || []);
        this.formulariosList.set(formularios || []);

        const activo = (periodos || []).find((p: any) => p.activo);
        if (activo) {
          this.periodoActivo.set(activo);
          const periodoIdentificador = activo.id || activo.nombre;
          
          this.filtros.update((prev) => ({ ...prev, periodoId: periodoIdentificador }));
          this.filtrosPoblacion.update((prev) => ({ ...prev, periodoId: periodoIdentificador }));
        }

        this.isLoading.set(false);
        this.inicializarGraficos();
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
    this.inicializarGraficos();
  }

  limpiarFiltros(): void {
    const pActivoId = this.periodoActivo()?.id || this.periodoActivo()?.nombre || '';
    this.filtros.set({
      periodoId: pActivoId,
      carreraId: '',
      cicloId: '',
      etnia: '',
      sexo: '',
      zona: '',
      estadoFicha: '',
      nivelEconomico: '',
      busqueda: '',
    });
    this.inicializarGraficos();
  }

  pctCondicion(total: number): number {
    const base = this.fichasFiltradas().length || 1;
    return Math.round((total / base) * 100);
  }

  cambiarTipoGrafico(_cual: string, tipo: 'bar' | 'pie'): void {
    this.tipoGraficoCarrera.set(tipo);
    this.inicializarGraficos();
  }

  // ===================== GRÁFICOS =====================
  inicializarGraficos(): void {
    const fichas = this.fichasFiltradas() as any[];
    const carreras = this.carrerasList();
    this.renderCarreraChart(fichas, carreras);
  }

  private renderCarreraChart(fichas: any[], carreras: Carrera[]): void {
    if (!this.carreraChartCanvas) return;

    const labels: string[] = [];
    const enviadas: number[] = [];
    const validadas: number[] = [];
    const borradores: number[] = [];

    const carreraFiltro = this.filtros().carreraId;
    const lista = carreraFiltro
      ? carreras.filter((c) => String(c.id) === String(carreraFiltro))
      : carreras;

    lista.forEach((carrera) => {
      labels.push(carrera.nombre);

      const deCarrera = fichas.filter((x) => {
        const carreraId = x.usuario?.carrera_id || x.usuario?.carrera?.id || x.carrera_id || x.carrera?.id;
        const nombreMatch = x.carrera && x.carrera.toLowerCase().includes(carrera.nombre.toLowerCase());
        return String(carreraId) === String(carrera.id) || nombreMatch;
      });

      enviadas.push(deCarrera.filter((x) => this.obtenerEstadoNormalizado(x) === 'POR VALIDAR').length);
      validadas.push(deCarrera.filter((x) => this.obtenerEstadoNormalizado(x) === 'VALIDADO').length);
      borradores.push(deCarrera.filter((x) => this.obtenerEstadoNormalizado(x) === 'BORRADOR').length);
    });

    const ctx = this.carreraChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.carreraChart?.destroy();

    const tipo = this.tipoGraficoCarrera();
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
                callback: function (this: any, value: string | number) {
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
}