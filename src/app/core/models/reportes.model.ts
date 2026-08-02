export interface FiltroPreguntaDisponible {
  pregunta_id: string;
  enunciado: string;
  seccion_nombre?: string;
  tipo_campo: string;
  opciones?: Array<{
    opcion_id?: string;
    texto_opcion: string;
  }>;
  es_numerico?: boolean;
}

export interface FiltroReporteRequest {
  periodo_id: string;
  formulario_id?: string;
  carrera_id?: string;
  ciclo_id?: string;
  estado_ficha?: string;
  preguntas?: Array<{
    pregunta_id: string;
    opcion_id?: string;
    valor_min?: number;
    valor_max?: number;
    texto?: string;
  }>;
}

export interface DatasetFiltradoResponse {
  total_registros: number;
  registros: Array<Record<string, unknown>>;
  columnas?: string[];
}

export interface AgregadoPorPregunta {
  pregunta_id: string;
  enunciado: string;
  seccion_nombre?: string;
  tipo_campo?: string;
  total_respuestas: number;
  agregados: Array<{
    etiqueta: string;
    total: number;
    porcentaje: number;
  }>;
}
