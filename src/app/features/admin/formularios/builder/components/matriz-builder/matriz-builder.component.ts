import { Component, Input, Output, EventEmitter, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FilaMatriz, ColumnaMatriz } from '../../../../../../core/models/formulario.model';

@Component({
  selector: 'app-matriz-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './matriz-builder.component.html',
  styleUrls: ['./matriz-builder.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatrizBuilderComponent implements OnInit {
  @Input() preguntaId?: string;
  @Input() filasExistentes: FilaMatriz[] = [];
  @Input() columnasExistentes: ColumnaMatriz[] = [];
  
  // Para binding en tiempo real con el FormParent (si se usa inline)
  @Input() parentForm?: FormGroup;

  @Output() agregarFila = new EventEmitter<{ preguntaId: string; texto: string }>();
  @Output() eliminarFila = new EventEmitter<string>();
  @Output() agregarColumna = new EventEmitter<{ preguntaId: string; texto: string }>();
  @Output() eliminarColumna = new EventEmitter<string>();

  // Formulario reactivo interno para creación interactiva
  matrizForm: FormGroup;
  
  // Vista previa seleccionada por el usuario en tiempo real
  previewSimulada = signal<{ [key: string]: string }>({});

  constructor(private fb: FormBuilder) {
    this.matrizForm = this.fb.group({
      nuevaFilaTexto: [''],
      nuevaColumnaTexto: [''],
      filasTemp: this.fb.array([]),
      columnasTemp: this.fb.array([])
    });
  }

  ngOnInit(): void {
    // Cargar datos si vienen de un formulario existente
    if (this.parentForm) {
      this.sincronizarConParentForm();
    } else {
      this.cargarPredeterminados();
    }
  }

  get filasTempArray(): FormArray {
    return (this.parentForm?.get('filasTemp') as FormArray) || (this.matrizForm.get('filasTemp') as FormArray);
  }

  get columnasTempArray(): FormArray {
    return (this.parentForm?.get('columnasTemp') as FormArray) || (this.matrizForm.get('columnasTemp') as FormArray);
  }

  private sincronizarConParentForm(): void {
    if (this.filasTempArray.length === 0 && this.columnasTempArray.length === 0) {
      this.cargarPredeterminados();
    }
  }

  private cargarPredeterminados(): void {
    if (this.filasExistentes.length > 0) {
      this.filasExistentes.forEach(f => this.agregarFilaDirecto(f.texto_fila));
    }
    if (this.columnasExistentes.length > 0) {
      this.columnasExistentes.forEach(c => this.agregarColumnaDirecto(c.texto_columna));
    }
  }

  // --- MÉTODOS RÁPIDOS DE FILAS ---
  agregarFilaDirecto(texto: string = ''): void {
    const val = texto.trim() || this.matrizForm.get('nuevaFilaTexto')?.value?.trim();
    if (!val && !texto) return;

    if (this.preguntaId) {
      this.agregarFila.emit({ preguntaId: this.preguntaId, texto: val });
    } else {
      this.filasTempArray.push(
        this.fb.group({
          texto_fila: [val, Validators.required]
        })
      );
    }
    this.matrizForm.get('nuevaFilaTexto')?.reset('');
  }

  eliminarFilaTemp(index: number, filaId?: string): void {
    if (filaId && this.preguntaId) {
      this.eliminarFila.emit(filaId);
    } else {
      this.filasTempArray.removeAt(index);
    }
  }

  // --- MÉTODOS RÁPIDOS DE COLUMNAS ---
  agregarColumnaDirecto(texto: string = ''): void {
    const val = texto.trim() || this.matrizForm.get('nuevaColumnaTexto')?.value?.trim();
    if (!val && !texto) return;

    if (this.preguntaId) {
      this.agregarColumna.emit({ preguntaId: this.preguntaId, texto: val });
    } else {
      this.columnasTempArray.push(
        this.fb.group({
          texto_columna: [val, Validators.required]
        })
      );
    }
    this.matrizForm.get('nuevaColumnaTexto')?.reset('');
  }

  eliminarColumnaTemp(index: number, columnaId?: string): void {
    if (columnaId && this.preguntaId) {
      this.eliminarColumna.emit(columnaId);
    } else {
      this.columnasTempArray.removeAt(index);
    }
  }

  // --- PLANTILLAS PREDEFINIDAS RÁPIDAS ---
  aplicarPlantillaLikert5(): void {
    this.limpiarTodo();
    const columnas = ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo'];
    columnas.forEach(c => this.agregarColumnaDirecto(c));
    this.agregarFilaDirecto('Aspecto o Criterio 1');
    this.agregarFilaDirecto('Aspecto o Criterio 2');
  }

  aplicarPlantillaFrecuencia(): void {
    this.limpiarTodo();
    const columnas = ['Nunca', 'Rara vez', 'A veces', 'Frecuentemente', 'Siempre'];
    columnas.forEach(c => this.agregarColumnaDirecto(c));
    this.agregarFilaDirecto('Frecuencia del servicio');
    this.agregarFilaDirecto('Atención brindada');
  }

  aplicarPlantillaCalificacion(): void {
    this.limpiarTodo();
    const columnas = ['Malo', 'Regular', 'Bueno', 'Excelente'];
    columnas.forEach(c => this.agregarColumnaDirecto(c));
    this.agregarFilaDirecto('Infraestructura');
    this.agregarFilaDirecto('Equipamiento');
  }

  limpiarTodo(): void {
    while (this.filasTempArray.length !== 0) {
      this.filasTempArray.removeAt(0);
    }
    while (this.columnasTempArray.length !== 0) {
      this.columnasTempArray.removeAt(0);
    }
  }

  // Interacción simulada en la vista previa en vivo
  seleccionarOpcionPrevio(filaIndex: number, colIndex: number): void {
    this.previewSimulada.update(actual => ({
      ...actual,
      [filaIndex]: colIndex.toString()
    }));
  }
}