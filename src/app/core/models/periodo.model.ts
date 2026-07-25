export interface PeriodoMatricula {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  fecha_desactivacion: string | null;
}

export interface CreatePeriodoDto {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}