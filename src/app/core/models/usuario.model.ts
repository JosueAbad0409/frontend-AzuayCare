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

// ✅ CORRECCIÓN: Los campos carrera y ciclo ahora son opcionales
export interface CompletarPerfilDto {
  cedula: string;
  carrera_id?: string;
  ciclo_id?: string;
}