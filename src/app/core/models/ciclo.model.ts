export interface Ciclo {
  id?: string;
  nombre: string;
  orden?: number; 
  carrera_id: string;
  carrera?: {
    id: string;
    nombre: string;
  };
  fecha_desactivacion?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCicloDto {
  nombre: string;
  carrera_id: string;
  orden?: number;
}

export interface UpdateCicloDto {
  nombre?: string;
  carrera_id?: string;
  orden?: number;
}