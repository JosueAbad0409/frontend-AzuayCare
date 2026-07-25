export interface EnviarRespuestaDto {
  ficha_id: string;
  pregunta_id: string;
  valor_texto?: string | null;
  valor_numerico?: number | null;
  opciones_seleccionadas?: string[];
  fila_id?: string | null;
  columna_id?: string | null;
}

export interface GuardarBloqueRespuestasDto {
  respuestas: EnviarRespuestaDto[];
}