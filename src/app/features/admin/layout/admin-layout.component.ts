import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

declare var gsap: any;

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements AfterViewInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isSidebarCollapsed = signal<boolean>(false);

  ngAfterViewInit() {
    this.animateEntrance();
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
    this.isSidebarCollapsed.update(val => !val);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
