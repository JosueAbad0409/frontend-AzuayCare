// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\core\models\matriz.model.ts

export interface FilaMatriz {
  id: string;
  pregunta_id: string;
  texto_fila: string;
  orden?: number;
}

export interface ColumnaMatriz {
  id: string;
  pregunta_id: string;
  texto_columna: string;
  orden?: number;
}

export interface CreateFilaDto {
  pregunta_id?: string;
  texto_fila: string;
  orden?: number;
}

export interface CreateColumnaDto {
  pregunta_id?: string;
  texto_columna: string;
  orden?: number;
}

export interface RespuestaMatrizDto {
  ficha_id: string;
  fila_id: string;
  columna_id: string;
  valor_texto?: string;
}