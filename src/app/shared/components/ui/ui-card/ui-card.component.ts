import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-card.component.html',
  styleUrl: './ui-card.component.css'
})
export class UiCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() elevated = false;
}
