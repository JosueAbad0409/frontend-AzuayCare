import { TipoFormulario } from './tipo-formulario.model';
import { 
  FilaMatriz, 
  ColumnaMatriz, 
  CreateFilaDto, 
  CreateColumnaDto 
} from './matriz.model';

export type { FilaMatriz, ColumnaMatriz, CreateFilaDto, CreateColumnaDto };

export interface RangoCalculado {
  id: string;
  formulario_id: string;
  variable_calculo: string;
  nombre: string;
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

export interface Formulario {
  id: string;
  titulo: string;
  descripcion?: string | null;
  tipo_formulario_id: string;
  tipoFormulario?: TipoFormulario;
  periodo_id: string;
  version: number;
  publicado: boolean;
  bloqueado: boolean;
  fecha_bloqueo?: string | null;
  fecha_publicacion?: string | null;
  
  umbral_balance_critico?: number;
  puntos_balance_critico?: number;
  umbral_prioridad_alta?: number;
  umbral_auto_validacion?: number;

  created_at: string;
  secciones?: Seccion[];
  rangos_calculados?: RangoCalculado[];
}

export interface CreateFormularioDto {
  periodo_id: string;
  titulo: string;
  descripcion?: string;
  tipo_formulario_id: string;
  
  umbral_balance_critico?: number;
  puntos_balance_critico?: number;
  umbral_prioridad_alta?: number;
  umbral_auto_validacion?: number;
}

export interface Seccion {
  id: string;
  formulario_id: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  tipo_seccion?: 'INFORMACION_GENERAL' | 'FINANCIERA' | 'NEE_SALUD';
  subcategoria_financiera?: 'INGRESOS' | 'GASTOS' | 'AMBOS' | 'NINGUNO';
  preguntas?: Pregunta[];
}

export interface CreateSeccionDto {
  formulario_id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  tipo_seccion?: 'INFORMACION_GENERAL' | 'FINANCIERA' | 'NEE_SALUD';
  subcategoria_financiera?: 'INGRESOS' | 'GASTOS' | 'AMBOS' | 'NINGUNO';
}

export interface TipoCampoForm {
  id: string;
  nombre: 'TEXTO' | 'NUMERICO' | 'SELECCION_UNICA' | 'SELECCION_MULTIPLE' | 'MATRIZ' | 'FECHA';
  descripcion?: string;
}

export interface OpcionPregunta {
  id?: string;
  pregunta_id?: string;
  texto_opcion: string;
  orden?: number;
  permite_texto_libre?: boolean;
  valor_ponderado?: number;
  es_correcta?: boolean;
  puntaje_riesgo?: number;
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
  es_correcta?: boolean;
  puntaje_riesgo?: number;
  dispara_dependencia?: boolean;
  pregunta_hija_id?: string;
  subpregunta_enunciado?: string;
  subpregunta_tipo_id?: string;
  subpregunta_categoria_financiera?: 'INGRESO' | 'EGRESO' | 'NINGUNO';
  subpregunta_requiere_evidencia?: boolean;
}

export interface Pregunta {
  id: string;
  seccion_id: string;
  enunciado: string;
  tipo_campo_id: string;
  tipoCampo?: TipoCampoForm;
  categoria_financiera: 'INGRESO' | 'EGRESO' | 'NINGUNO';
  
  clave_semantica?: string | null;
  revision_manual_obligatoria?: boolean;
  
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
  
  clave_semantica?: string | null;
  revision_manual_obligatoria?: boolean;
  
  es_obligatorio?: boolean;
  orden?: number;
  codigo_sistema?: string;
  requiere_evidencia?: boolean;
  opciones?: CreateOpcionDto[];
  
  // ✅ NUEVA: Incluir estructura de matriz
  filasMatriz?: CreateFilaDto[];
  columnasMatriz?: CreateColumnaDto[];
}