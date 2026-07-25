export interface Ciclo {
  id?: string;
  nombre: string; 
  carreraId: string;
  carreraNombre?: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCicloDto {
  nombre: string;
  carreraId: string;
}

export interface UpdateCicloDto {
  nombre?: string;
  carreraId?: string;
  activo?: boolean;
}