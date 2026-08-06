export interface PreguntaDependencia {
  id: string;
  pregunta_id: string;
  pregunta_disparadora_id: string;
  opcion_disparadora_id?: string;
  valor_disparador?: string;
}

export interface CreateDependenciaDto {
  pregunta_id: string;
  pregunta_disparadora_id: string;
  opcion_disparadora_id?: string;
  valor_disparador?: string;
}