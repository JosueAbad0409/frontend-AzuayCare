export interface Ciclo {
  id?: string;
  nombre: string;
  orden?: number;
  fecha_desactivacion?: string | null;
  created_at?: string;
  updated_at?: string;

  ciclosCarreras?: {
    id: string;
    ciclo_id?: string;
    carrera_id: string;
    carrera?: {
      id: string;
      nombre: string;
    };
  }[];
}

export interface CreateCicloDto {
  nombre: string;
  orden: number;
  carrera_ids: string[];
}

export interface UpdateCicloDto {
  nombre?: string;
  orden?: number;
  carrera_ids?: string[];
}