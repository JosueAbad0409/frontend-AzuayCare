import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  protected readonly title = signal('azuaycare-frontend');
  protected readonly theme = signal<'light' | 'dark'>('light');

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    const savedTheme = window.localStorage.getItem('azuaycare-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme ?? (prefersDark ? 'dark' : 'light');
    this.applyTheme(initialTheme);
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme);
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('azuaycare-theme', theme);
  }
}
