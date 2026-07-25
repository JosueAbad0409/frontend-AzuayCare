import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FichaService } from '../../../core/services/ficha/ficha.service';
import { PeriodoService } from '../../../core/services/periodo/periodo.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-niveles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './niveles.component.html',
  styleUrls: ['./niveles.component.css']
})
export class NivelesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly periodoService = inject(PeriodoService);
  private readonly fb = inject(FormBuilder);
  private readonly apiUrl = `${environment.apiUrl}/niveles-economicos`;

  niveles = signal<any[]>([]);
  periodos = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  showForm = signal<boolean>(false);

  nivelForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    valor_min: [0, [Validators.required, Validators.min(0)]],
    valor_max: [null],
    periodo_id: ['', Validators.required],
    orden: [1, Validators.required]
  });

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.isLoading.set(true);
    this.periodoService.getPeriodos().subscribe({
      next: (p) => this.periodos.set(p)
    });

    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.niveles.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  guardarNivel() {
    if (this.nivelForm.invalid) return;

    this.http.post(this.apiUrl, this.nivelForm.value).subscribe({
      next: () => {
        this.nivelForm.reset({ orden: 1, valor_min: 0 });
        this.showForm.set(false);
        this.cargarDatos();
      },
      error: (err) => alert(err?.error?.message || 'Error al guardar nivel.')
    });
  }

  eliminarNivel(id: string) {
    if (confirm('¿Dar de baja este nivel económico?')) {
      this.http.delete(`${this.apiUrl}/${id}`).subscribe({
        next: () => this.cargarDatos()
      });
    }
  }
}