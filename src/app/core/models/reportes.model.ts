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
  // Dependencias (subpreguntas)
  es_dependiente?: boolean;
  depende_de_pregunta_id?: string | null;
  depende_de_enunciado?: string | null;
  depende_de_opcion_id?: string | null;
  depende_de_opcion_texto?: string | null;
}

export interface FiltroReporteRequest {
  periodo_id: string;
  formulario_id?: string;
  carrera_id?: string;
  ciclo_id?: string;
  estado_ficha?: string;
  pregunta_id?: string;
  valor_pregunta?: string | number | null;
  preguntas?: Array<{
    pregunta_id: string;
    opcion_id?: string;
    valor_min?: number;
    valor_max?: number;
    texto?: string;
  }>;
  columnas_base?: string[];
  columnas_pregunta_ids?: string[];
}

export interface DatasetFiltradoResponse {
  total_registros?: number;
  total?: number;
  registros?: Array<Record<string, unknown>>;
  datos?: Array<Record<string, unknown>>;
  columnas?: string[];
  columnas_dataset?: string[];
}

export interface AgregadoOpcion {
  opcion_id?: string;
  texto: string;
  conteo: number;
  porcentaje: number;
}

export interface AgregadoMetricas {
  tipo_grafico: 'PIE_O_BARRA' | 'METRICA_NUMERICA' | 'TEXTO_LIBRE' | 'MATRIZ_AGREGADA' | string;
  opciones?: AgregadoOpcion[];
  promedio?: number;
  minimo?: number;
  maximo?: number;
  suma?: number;
  total_respuestas?: number;
  matriz_respuestas?: any[];
}

export interface AgregadoPorPregunta {
  seccion_id?: string;
  seccion_nombre?: string;
  pregunta_id: string;
  enunciado: string;
  tipo_campo?: string;
  metricas?: AgregadoMetricas;
  total_respuestas?: number;
  agregados?: Array<{
    etiqueta: string;
    total: number;
    porcentaje: number;
  }>;
}

export interface DashboardResumenBackend {
  totalCarreras: number;
  totalFormularios: number;
  totalFichasEvaluadas: number;
  periodoActivo: any;
  graficos: {
    nivelesEconomicos: { labels: string[]; data: number[] };
    nivelesVulnerabilidad: { labels: string[]; data: number[] };
    fichasPorCarrera: { labels: string[]; enviadas: number[]; validadas: number[] };
  };
}