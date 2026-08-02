import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-button.component.html',
  styleUrl: './ui-button.component.css'
})
export class UiButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() fullWidth = false;
  @Input() disabled = false;
  @Input() href = '';

  get classes(): string {
    return [
      'ui-button',
      `ui-button--${this.variant}`,
      `ui-button--${this.size}`,
      this.fullWidth ? 'ui-button--full' : ''
    ].filter(Boolean).join(' ');
  }
}
