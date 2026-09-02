import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnChanges, 
  SimpleChanges, 
  signal, 
  ChangeDetectionStrategy, 
  HostListener,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
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
export class MatrizBuilderComponent implements OnInit, OnChanges {
  @Input() preguntaId?: string;
  @Input() filasExistentes: FilaMatriz[] = [];
  @Input() columnasExistentes: ColumnaMatriz[] = [];
  @Input() parentForm?: FormGroup;
  @Input() readonly: boolean = false;

  @Output() agregarFila = new EventEmitter<{ preguntaId: string; texto: string; es_multiple: boolean }>();
  @Output() eliminarFila = new EventEmitter<string>();
  @Output() agregarColumna = new EventEmitter<{ preguntaId: string; texto: string }>();
  @Output() eliminarColumna = new EventEmitter<string>();
  @Output() actualizarFila = new EventEmitter<{ filaId: string; es_multiple: boolean }>();
  @Output() guardarFilas = new EventEmitter<{ id?: string; texto_fila: string; es_multiple: boolean; orden?: number }[]>();
  @Output() guardarColumnas = new EventEmitter<{ id?: string; texto_columna: string; orden?: number }[]>();

  matrizForm: FormGroup;
  previewSimulada = signal<{ [key: number]: string | string[] }>({});

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.matrizForm = this.fb.group({
      nuevaFilaTexto: [''],
      nuevaFilaEsMultiple: [false],
      nuevaColumnaTexto: [''],
      filasTemp: this.fb.array([]),
      columnasTemp: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.cargarEstructuraInicial();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filasExistentes'] || changes['columnasExistentes'] || changes['readonly']) {
      this.cargarEstructuraInicial();
    }
  }

  get filasTempArray(): FormArray {
    return (this.parentForm?.get('filasTemp') as FormArray) || (this.matrizForm.get('filasTemp') as FormArray);
  }

  get columnasTempArray(): FormArray {
    return (this.parentForm?.get('columnasTemp') as FormArray) || (this.matrizForm.get('columnasTemp') as FormArray);
  }

  private cargarEstructuraInicial(): void {
  // ✅ SIEMPRE limpiar, sin condición
  this.filasTempArray.clear();
  
  if (this.filasExistentes && this.filasExistentes.length > 0) {
    this.filasExistentes.forEach(f => {
      if (f && f.texto_fila) {
        const esMult = f.es_multiple ?? f.permitir_multiple ?? false;
        this.filasTempArray.push(
          this.fb.group({
            id: [f.id || null],
            texto_fila: [f.texto_fila, [Validators.required, Validators.maxLength(255)]],
            es_multiple: [Boolean(esMult)]
          })
        );
      }
    });
  }

  // ✅ MISMA LÓGICA para columnas
  this.columnasTempArray.clear();
  
  if (this.columnasExistentes && this.columnasExistentes.length > 0) {
    this.columnasExistentes.forEach(c => {
      if (c && c.texto_columna) {
        this.columnasTempArray.push(
          this.fb.group({
            id: [c.id || null],
            texto_columna: [c.texto_columna, [Validators.required, Validators.maxLength(255)]]
          })
        );
      }
    });
  }
  this.cdr.markForCheck();
}

  // ✅ NUEVO: Obtener datos finales para guardar
  obtenerDatosMatriz() {
    const filas = this.filasTempArray.value.map((f: any, idx: number) => ({
      id: f.id || undefined,
      texto_fila: f.texto_fila,
      es_multiple: f.es_multiple === true || f.es_multiple === 'true',
      orden: f.orden || (idx + 1)
    }));

    const columnas = this.columnasTempArray.value.map((c: any, idx: number) => ({
      id: c.id || undefined,
      texto_columna: c.texto_columna,
      orden: c.orden || (idx + 1)
    }));

    return { filas, columnas };
  }

  // ✅ NUEVO: Emitir datos antes de guardar pregunta
  guardarMatriz(): void {
    const { filas, columnas } = this.obtenerDatosMatriz();
    this.guardarFilas.emit(filas);
    this.guardarColumnas.emit(columnas);
  }

  agregarFilaDirecto(texto: string = '', esMultiple: boolean = false): void {
    if (this.readonly) return;
    const rawVal = texto || this.matrizForm.get('nuevaFilaTexto')?.value || '';
    const val = String(rawVal).trim();
    if (!val) return;

    const multVal = texto ? esMultiple : !!this.matrizForm.get('nuevaFilaEsMultiple')?.value;

    this.filasTempArray.push(
      this.fb.group({
        id: [null],
        texto_fila: [val, [Validators.required, Validators.maxLength(255)]],
        es_multiple: [multVal]
      })
    );

    this.matrizForm.get('nuevaFilaTexto')?.reset('');
    this.matrizForm.get('nuevaFilaEsMultiple')?.setValue(false);
    this.cdr.markForCheck();
  }

  eliminarFilaTemp(index: number, filaId?: string): void {
    if (this.readonly || index < 0) return;
    if (filaId && this.preguntaId) {
      this.eliminarFila.emit(filaId);
    }
    if (index < this.filasTempArray.length) {
      this.filasTempArray.removeAt(index);
    }
    this.cdr.markForCheck();
  }

  toggleFilaMultiple(index: number): void {
    if (this.readonly) return;

    const filaGroup = this.filasTempArray.at(index) as FormGroup;
    if (filaGroup) {
      const valorActual = !!filaGroup.get('es_multiple')?.value;
      const nuevoValor = !valorActual;
      
      filaGroup.get('es_multiple')?.setValue(nuevoValor);
      filaGroup.get('es_multiple')?.markAsDirty();
      filaGroup.get('es_multiple')?.updateValueAndValidity();

      const filaId = filaGroup.get('id')?.value;
      if (this.preguntaId && filaId) {
        this.actualizarFila.emit({ filaId, es_multiple: nuevoValor });
      }
    }

    this.previewSimulada.update(actualState => {
      const copia = { ...actualState };
      delete copia[index];
      return copia;
    });

    this.cdr.markForCheck();
  }

  esFilaMultiple(index: number): boolean {
    const filaGroup = this.filasTempArray.at(index) as FormGroup;
    return !!filaGroup?.get('es_multiple')?.value;
  }

  agregarColumnaDirecto(texto: string = ''): void {
    if (this.readonly) return;
    const rawVal = texto || this.matrizForm.get('nuevaColumnaTexto')?.value || '';
    const val = String(rawVal).trim();
    if (!val) return;

    this.columnasTempArray.push(
      this.fb.group({
        id: [null],
        texto_columna: [val, [Validators.required, Validators.maxLength(255)]]
      })
    );

    this.matrizForm.get('nuevaColumnaTexto')?.reset('');
    this.cdr.markForCheck();
  }

  eliminarColumnaTemp(index: number, columnaId?: string): void {
    if (this.readonly || index < 0) return;
    if (columnaId && this.preguntaId) {
      this.eliminarColumna.emit(columnaId);
    }
    if (index < this.columnasTempArray.length) {
      this.columnasTempArray.removeAt(index);
    }
    this.cdr.markForCheck();
  }

  aplicarPlantillaLikert5(): void {
    if (this.readonly) return;
    this.limpiarTodo();
    const columnas = ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo'];
    columnas.forEach(c => this.agregarColumnaDirecto(c));
    this.agregarFilaDirecto('Aspecto 1', false);
    this.agregarFilaDirecto('Aspecto 2', true);
  }

  aplicarPlantillaFrecuencia(): void {
    if (this.readonly) return;
    this.limpiarTodo();
    const columnas = ['Nunca', 'Rara vez', 'A veces', 'Frecuentemente', 'Siempre'];
    columnas.forEach(c => this.agregarColumnaDirecto(c));
    this.agregarFilaDirecto('Frecuencia del servicio', false);
    this.agregarFilaDirecto('Atención brindada', false);
  }

  aplicarPlantillaCalificacion(): void {
    if (this.readonly) return;
    this.limpiarTodo();
    const columnas = ['Malo', 'Regular', 'Bueno', 'Excelente'];
    columnas.forEach(c => this.agregarColumnaDirecto(c));
    this.agregarFilaDirecto('Infraestructura', false);
    this.agregarFilaDirecto('Equipamiento', false);
  }

  limpiarTodo(): void {
    if (this.readonly) return;
    this.filasTempArray.clear();
    this.columnasTempArray.clear();
    this.previewSimulada.set({});
    this.cdr.markForCheck();
  }

  seleccionarOpcionPrevio(filaIndex: number, colIndex: number): void {
    const colStr = colIndex.toString();
    const esMult = this.esFilaMultiple(filaIndex);

    this.previewSimulada.update(actual => {
      const actualVal = actual[filaIndex];

      if (!esMult) {
        return { ...actual, [filaIndex]: colStr };
      } else {
        const currentArr = Array.isArray(actualVal) ? [...actualVal] : [];
        const idx = currentArr.indexOf(colStr);
        if (idx >= 0) {
          currentArr.splice(idx, 1);
        } else {
          currentArr.push(colStr);
        }
        return { ...actual, [filaIndex]: currentArr };
      }
    });
    this.cdr.markForCheck();
  }

  isColSelected(filaIndex: number, colIndex: number): boolean {
    const val = this.previewSimulada()[filaIndex];
    const colStr = colIndex.toString();
    return Array.isArray(val) ? val.includes(colStr) : val === colStr;
  }

  @HostListener('keydown.enter', ['$event'])
  preventEnterSubmit(event: Event): void {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'INPUT') {
      const type = (target as HTMLInputElement).type;
      if (type === 'text' || type === 'number') {
        event.preventDefault();
      }
    }
  }
}