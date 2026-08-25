export interface RangoVariableCalculada {
  id: string;
  formulario_id: string;
  variable_calculo: string;
  nombre: string;
  valor_min: number;
  valor_max?: number | null;
  es_vulnerable?: boolean;
  orden: number;
}

export interface CreateRangoVariableDto {
  formulario_id: string;
  variable_calculo: string;
  nombre: string;
  valor_min: number;
  valor_max?: number;
  es_vulnerable?: boolean;
  orden?: number;
}