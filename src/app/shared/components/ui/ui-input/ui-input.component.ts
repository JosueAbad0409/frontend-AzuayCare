import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-ui-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-input.component.html',
  styleUrl: './ui-input.component.css',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiInputComponent),
    multi: true
  }]
})
export class UiInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type: 'text' | 'number' | 'email' | 'password' = 'text';
  @Input() icon = '';
  @Input() hint = '';
  @Input() disabled = false;
  @Input() value: string | number = '';
  @Output() valueChange = new EventEmitter<string | number>();

  private onChange: (_: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number') {
      this.value = value;
      return;
    }
    this.value = '';
  }

  registerOnChange(fn: (_: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nextValue = this.type === 'number' ? Number(input.value) : input.value;
    this.value = nextValue;
    this.valueChange.emit(nextValue);
    this.onChange(nextValue);
  }

  onBlur(): void {
    this.onTouched();
  }
}
