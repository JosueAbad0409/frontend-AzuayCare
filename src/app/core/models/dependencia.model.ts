export interface PreguntaDependencia {
  id: string;
  pregunta_disparadora_id: string;
  opcion_disparadora_id: string;
  pregunta_dependiente_id: string;
}

export interface CreateDependenciaDto {
  pregunta_disparadora_id: string;
  opcion_disparadora_id: string;
  pregunta_dependiente_id: string;
}