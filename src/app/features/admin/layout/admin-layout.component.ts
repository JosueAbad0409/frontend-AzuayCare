import {
  Component,
  inject,
  signal,
  computed,
  AfterViewInit,
  OnInit,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { PrioridadAtencionService } from '../../../core/services/prioridad-atencion.service';
import { environment } from '../../../../environments/environment';
import { PeriodoService } from '../../../core/services/periodo.service';

declare var gsap: any;

interface MensajeChat {
  rol: 'user' | 'bot';
  texto: string;
  fuentes?: Array<{
    tool: string;
    filas?: number;
    consultado_en?: string;
  }>;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent implements OnInit, AfterViewInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly http = inject(HttpClient);
  private readonly periodoService = inject(PeriodoService);

  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly isSidebarOpenMobile = signal<boolean>(false);
  readonly casosAltoCount = signal<number>(0);

  readonly chatAbierto = signal<boolean>(false);
  readonly iaCargando = signal<boolean>(false);
  readonly mensajes = signal<MensajeChat[]>([]);
  promptActual = '';

  private readonly chatMessagesRef = viewChild<ElementRef<HTMLDivElement>>('chatMessages');

  readonly esCoordinadorBienestar = computed(() => {
    const rol = this.authService.user()?.rol as any;
    const rolStr = typeof rol === 'string' ? rol : rol?.nombre || '';
    return rolStr.includes('COORDINADOR_BIENESTAR') || rolStr.includes('ADMIN');
  });

  readonly esCoordinadorCarrera = computed(() => {
    const rol = this.authService.user()?.rol as any;
    const rolStr = typeof rol === 'string' ? rol : rol?.nombre || '';
    return rolStr.includes('COORDINADOR_CARRERA');
  });

  readonly tieneAccesoPrioridad = computed(() => {
    return this.esCoordinadorBienestar() || this.esCoordinadorCarrera();
  });

  readonly tieneAccesoUsuarios = computed(() => {
    return this.esCoordinadorBienestar() || this.esCoordinadorCarrera();
  });

  ngOnInit(): void {
    if (this.tieneAccesoPrioridad()) {
      this.cargarCasosAlto();
    }
  }

  ngAfterViewInit(): void {
    this.animateEntrance();
  }

  private cargarCasosAlto(): void {
    this.periodoService.getPeriodos().subscribe({
      next: (periodos) => {
        const periodoActivo = (periodos || []).find((p) => p.activo);

        if (periodoActivo) {
          this.prioridadService.getReporteNee(periodoActivo.id).subscribe({
            next: (res) => {
              const data = res || [];

              // 🔥 FILTRO CLAVE: Excluir borradores para coincidir con la pantalla de Prioridad de Atención
              const casosValidos = data.filter((item) => {
                const est = String(item.estado_ficha || '').toUpperCase().trim();
                return est !== 'BORRADOR' && est !== '';
              });

              if (this.esCoordinadorCarrera()) {
                const user: any = this.authService.user();
                const carrerasUsuario = user?.carrerasCoordinadas || (user?.carrera ? [user.carrera] : []);

                const nombresCarrera: string[] = carrerasUsuario.map((c: any) =>
                  (c.nombre || c || '').toLowerCase().trim()
                );

                const casosFiltrados = casosValidos.filter((item) => {
                  const carreraItem = (item.carrera || '').toLowerCase().trim();
                  return nombresCarrera.some((n) => carreraItem.includes(n) || n.includes(carreraItem));
                });

                this.casosAltoCount.set(casosFiltrados.length);
              } else {
                this.casosAltoCount.set(casosValidos.length);
              }
            },
            error: () => this.casosAltoCount.set(0),
          });
        } else {
          this.casosAltoCount.set(0);
        }
      },
      error: () => this.casosAltoCount.set(0),
    });
  }

  toggleChat(): void {
    this.chatAbierto.update((v) => !v);
  }

  cerrarChat(): void {
    this.chatAbierto.set(false);
  }

  enviarSugerencia(texto: string): void {
    this.promptActual = texto;
    this.enviarMensaje();
  }

  enviarMensaje(): void {
    const texto = this.promptActual.trim();
    if (!texto || this.iaCargando()) return;

    this.mensajes.update((m) => [...m, { rol: 'user', texto }]);
    this.promptActual = '';
    this.iaCargando.set(true);
    this.scrollChatAlFinal();

    this.http
      .post<{ response: string; fuentes?: any[] }>(
        `${environment.apiUrl}/ia/chat`,
        { prompt: texto },
      )
      .subscribe({
        next: (res) => {
          this.mensajes.update((m) => [
            ...m,
            {
              rol: 'bot',
              texto: res.response || 'Sin respuesta',
              fuentes: res.fuentes || [],
            },
          ]);
          this.iaCargando.set(false);
          this.scrollChatAlFinal();
        },
        error: () => {
          this.mensajes.update((m) => [
            ...m,
            {
              rol: 'bot',
              texto: 'No pude conectar con el asistente. Revisa la API o intenta de nuevo.',
            },
          ]);
          this.iaCargando.set(false);
          this.scrollChatAlFinal();
        },
      });
  }

  private scrollChatAlFinal(): void {
    setTimeout(() => {
      const el = this.chatMessagesRef()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
  }

  private animateEntrance(): void {
    if (typeof window !== 'undefined' && typeof gsap !== 'undefined') {
      gsap.from('.page-content > *', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
      });
    }
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.isSidebarOpenMobile.update((v) => !v);
    } else {
      this.isSidebarCollapsed.update((val) => !val);
    }
  }

  closeSidebarMobile(): void {
    this.isSidebarOpenMobile.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}