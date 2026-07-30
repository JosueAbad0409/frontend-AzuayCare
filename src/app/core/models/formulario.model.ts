// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\core\models\formulario.model.ts

import { 
  FilaMatriz, 
  ColumnaMatriz, 
  CreateFilaDto, 
  CreateColumnaDto 
} from './matriz.model';

export type { FilaMatriz, ColumnaMatriz, CreateFilaDto, CreateColumnaDto };

// --- INTERFAZ RANGOS Y VARIABLES CALCULADAS ---
export interface RangoCalculado {
  id: string;
  formulario_id: string;
  variable_calculo: string; // ej. 'BALANCE'
  nombre: string;           // ej. 'Vulnerable / Prioritario'
  valor_min: number;
  valor_max?: number | null;
  orden: number;
  created_at?: string;
}

export interface CreateRangoCalculadoDto {
  formulario_id: string;
  variable_calculo: string;
  nombre: string;
  valor_min: number;
  valor_max?: number | null;
  orden?: number;
}

// --- INTERFAZ FORMULARIO ---
export interface Formulario {
  id: string;
  titulo: string;
  descripcion?: string | null;
  tipo: string;
  periodo_id: string;
  version: number;
  publicado: boolean;
  fecha_publicacion?: string | null;
  created_at: string;
  secciones?: Seccion[];
  rangos_calculados?: RangoCalculado[];
}

export interface CreateFormularioDto {
  periodo_id: string;
  titulo: string;
  descripcion?: string;
  tipo?: string;
}

// --- INTERFAZ SECCIÓN ---
export interface Seccion {
  id: string;
  formulario_id: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  tipo_seccion?: 'INFORMACION_GENERAL' | 'FINANCIERA';
  subcategoria_financiera?: 'INGRESOS' | 'GASTOS' | 'AMBOS' | 'NINGUNO';
  preguntas?: Pregunta[];
}

export interface CreateSeccionDto {
  formulario_id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  tipo_seccion?: 'INFORMACION_GENERAL' | 'FINANCIERA';
  subcategoria_financiera?: 'INGRESOS' | 'GASTOS' | 'AMBOS' | 'NINGUNO';
}

// --- INTERFAZ TIPO DE CAMPO ---
export interface TipoCampoForm {
  id: string;
  nombre: 'TEXTO' | 'NUMERICO' | 'SELECCION_UNICA' | 'SELECCION_MULTIPLE' | 'MATRIZ';
  descripcion?: string;
}

// --- INTERFAZ OPCIÓN DE PREGUNTA ---
export interface OpcionPregunta {
  id?: string;
  pregunta_id?: string;
  texto_opcion: string;
  orden?: number;
  permite_texto_libre?: boolean;
  valor_ponderado?: number;
  es_correcta?: boolean; // <--- NUEVO CAMPO
  dispara_dependencia?: boolean;
  pregunta_hija_id?: string;
  subpregunta_enunciado?: string;
  subpregunta_tipo_id?: string;
  subpregunta_categoria_financiera?: 'INGRESO' | 'EGRESO' | 'NINGUNO';
  subpregunta_requiere_evidencia?: boolean;
}

export interface CreateOpcionDto {
  pregunta_id?: string;
  texto_opcion: string;
  orden?: number;
  permite_texto_libre?: boolean;
  valor_ponderado?: number;
  es_correcta?: boolean; // <--- NUEVO CAMPO
  dispara_dependencia?: boolean;
  pregunta_hija_id?: string;
  subpregunta_enunciado?: string;
  subpregunta_tipo_id?: string;
  subpregunta_categoria_financiera?: 'INGRESO' | 'EGRESO' | 'NINGUNO';
  subpregunta_requiere_evidencia?: boolean;
}

// --- INTERFAZ PREGUNTA ---
export interface Pregunta {
  id: string;
  seccion_id: string;
  enunciado: string;
  tipo_campo_id: string;
  tipoCampo?: TipoCampoForm;
  categoria_financiera: 'INGRESO' | 'EGRESO' | 'NINGUNO';
  es_obligatorio: boolean;
  orden: number;
  codigo_sistema?: string | null;
  requiere_evidencia: boolean;
  opciones?: OpcionPregunta[];
  filasMatriz?: FilaMatriz[];
  columnasMatriz?: ColumnaMatriz[];
}

export interface CreatePreguntaDto {
  seccion_id: string;
  enunciado: string;
  tipo_campo_id: string;
  categoria_financiera?: 'INGRESO' | 'EGRESO' | 'NINGUNO';
  es_obligatorio?: boolean;
  orden?: number;
  codigo_sistema?: string;
  requiere_evidencia?: boolean;
  opciones?: CreateOpcionDto[];
  filasMatriz?: CreateFilaDto[];
  columnasMatriz?: CreateColumnaDto[];
}