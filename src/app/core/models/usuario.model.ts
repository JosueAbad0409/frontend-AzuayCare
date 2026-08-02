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

// Datos que el propio estudiante llena en el pequeño formulario
// que aparece tras su primer inicio de sesión con Google.
export interface CompletarPerfilDto {
  cedula: string;
  carrera_id: string;
  ciclo_id: string;
}