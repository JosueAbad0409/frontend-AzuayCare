import { Component, inject, signal, AfterViewInit, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PrioridadAtencionService } from '../../../core/services/prioridad-atencion.service';

declare var gsap: any;

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLayoutComponent implements OnInit, AfterViewInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly prioridadService = inject(PrioridadAtencionService);

  isSidebarCollapsed = signal<boolean>(false);
  isSidebarOpenMobile = signal<boolean>(false);
  casosAltoCount = signal<number>(0);

  ngOnInit(): void {
  const user = this.authService.user();
  const rol = user?.rol as any;
  
  const esCoordinadorBienestar = 
    rol === 'COORDINADOR_BIENESTAR' || rol?.nombre === 'COORDINADOR_BIENESTAR';

  if (esCoordinadorBienestar) {
    this.cargarCasosAlto();
  }
}

  ngAfterViewInit(): void {
    this.animateEntrance();
  }

  private cargarCasosAlto(): void {
    this.prioridadService.getFichasPorPrioridad(0, 1, 'Alto').subscribe({
      next: (res) => this.casosAltoCount.set(res?.total || 0),
      error: (err) => {
        console.error('Error al cargar casos con alta prioridad:', err);
        this.casosAltoCount.set(0);
      }
    });
  }

  private animateEntrance(): void {
    if (typeof window !== 'undefined' && typeof gsap !== 'undefined') {
      gsap.from('.page-content > *', {
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out'
      });
    }
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.isSidebarOpenMobile.update(v => !v);
    } else {
      this.isSidebarCollapsed.update(val => !val);
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