export interface RolInfo {
  id?: string;
  nombre?: string;
}

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
  ciclo_id?: string | null;
  fecha_desactivacion?: string | null;
  foto_url?: string | null;
  fotoUrl?: string | null;
  
  // Propiedades aplanadas para acceso rápido en la UI
  email?: string;
  nombre?: string;

  // Permite estructura de objeto { id, nombre } o string sin romper validaciones estrictas
  rol?: any;
}

export interface CreateUsuarioDto {
  google_id: string;
  email_institucional: string;
  primer_nombre: string;
  primer_apellido: string;
  rol_id: string;
  carrera_id?: string;
}

export interface CompletarPerfilDto {
  cedula: string;
  carrera_id?: string;
  ciclo_id?: string;
}