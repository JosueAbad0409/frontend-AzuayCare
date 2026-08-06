import { Component, inject, signal, AfterViewInit, OnInit } from '@angular/core';
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
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements AfterViewInit, OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly prioridadService = inject(PrioridadAtencionService);

  isSidebarCollapsed = signal<boolean>(false);
  isSidebarOpenMobile = signal<boolean>(false);
  casosAltoCount = signal<number>(0);

  ngOnInit(): void {
    if (this.authService.user()?.rol === 'COORDINADOR_BIENESTAR') {
      this.cargarCasosAlto();
    }
  }

  ngAfterViewInit() {
    this.animateEntrance();
  }

  private cargarCasosAlto(): void {
    this.prioridadService.getFichasPorPrioridad(0, 1, 'Alto').subscribe({
      next: (res) => this.casosAltoCount.set(res.total || 0),
      error: () => this.casosAltoCount.set(0)
    });
  }

  private animateEntrance() {
    if (typeof gsap !== 'undefined') {
      gsap.from('.page-content > *', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
      });
    }
  }

  toggleSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.isSidebarOpenMobile.update(v => !v);
    } else {
      this.isSidebarCollapsed.update(val => !val);
    }
  }

  closeSidebarMobile() {
    this.isSidebarOpenMobile.set(false);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}