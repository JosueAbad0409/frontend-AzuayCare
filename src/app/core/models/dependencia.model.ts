export interface PreguntaDependencia {
  id: string;
  pregunta_disparadora_id: string;
  opcion_disparadora_id: string;
  pregunta_dependiente_id: string;
  valor_rango_min?: number;
  valor_rango_max?: number;
}

export interface CreateDependenciaDto {
  pregunta_disparadora_id: string;
  opcion_disparadora_id: string;
  pregunta_dependiente_id: string;
  valor_rango_min?: number;
  valor_rango_max?: number;
}