export interface Usuario {
  id: string;
  email_institucional: string;
  primer_nombre: string;
  primer_apellido: string;
  segundo_nombre?: string;
  segundo_apellido?: string;
  cedula?: string;
  rol_id: string;
  carrera_id?: string | null;
  rol?: {
    id: string;
    nombre: string;
  };
}

export interface CreateUsuarioDto {
  google_id: string;
  email_institucional: string;
  primer_nombre: string;
  primer_apellido: string;
  rol_id: string;
  carrera_id?: string;
}