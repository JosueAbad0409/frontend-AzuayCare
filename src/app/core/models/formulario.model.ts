import { FilaMatriz, ColumnaMatriz } from './matriz.model';

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
}

export interface CreateFormularioDto {
  periodo_id: string;
  titulo: string;
  descripcion?: string;
  tipo?: string;
}

export interface Seccion {
  id: string;
  formulario_id: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  preguntas?: Pregunta[];
}

export interface CreateSeccionDto {
  formulario_id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export interface TipoCampoForm {
  id: string;
  nombre: 'TEXTO' | 'NUMERICO' | 'SELECCION_UNICA' | 'SELECCION_MULTIPLE' | 'MATRIZ';
  descripcion?: string;
}

export interface OpcionPregunta {
  id?: string;
  pregunta_id?: string;
  texto_opcion: string;
  orden?: number;
  permite_texto_libre?: boolean;
}

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
}