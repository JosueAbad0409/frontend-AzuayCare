import { Carrera } from "./carrera.model";

export interface RolInfo {
  id?: string;
  nombre?: string;
  descripcion?: string;
}

export interface Usuario {
  id: string;
  email_institucional: string;
  primer_nombre: string;
  primer_apellido: string;
  segundo_nombre?: string;
  segundo_apellido?: string;
  cedula?: string;
  tipo_documento?: string;
  rol_id: string;
  carrera_id?: string | null;
  ciclo_id?: string | null;
  fecha_desactivacion?: string | null;
  foto_url?: string | null;
  fotoUrl?: string | null;
  perfil_completado?: boolean;
  
  // Propiedades aplanadas para acceso rápido en la UI
  email?: string;
  nombre?: string;

  // Permite estructura de objeto { id, nombre } o string sin romper validaciones estrictas
  rol?: any;
  carrera?: Carrera;

  // Expediente Socioeconómico y Ubicación
  fecha_nacimiento?: string;
  nacionalidad_id?: string;
  pais_nacimiento_id?: string;
  provincia_nacimiento_id?: string;
  canton_nacimiento_id?: string;
  sexo?: string;
  esta_embarazada?: boolean;
  genero?: string;
  numero_celular?: string;
  estado_civil?: string;
  tiene_hijos?: boolean;
  hijos_menores_5_anios?: number;
  etnia?: string;
  pueblo_nacionalidad?: string;
  etnia_otra?: string;
  idioma?: string;
}

export interface CreateUsuarioDto {
  google_id?: string;
  email_institucional: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  rol_id: string;
  carrera_id?: string;
}

export interface CompletarPerfilDto {
  tipo_documento?: string;
  cedula: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  email_institucional?: string;
  carrera_id?: string | null;
  ciclo_id?: string | null;
  sexo?: string;
  esta_embarazada?: boolean;
  genero?: string;
  numero_celular?: string;
  estado_civil?: string;
  tiene_hijos?: boolean;
  hijos_menores_5_anios?: number;
  etnia?: string;
  pueblo_nacionalidad?: string;
  etnia_otra?: string;
  idioma?: string;
  fecha_nacimiento?: string;
  nacionalidad_id?: string;
  pais_nacimiento_id?: string;
  provincia_nacimiento_id?: string;
  canton_nacimiento_id?: string;
  rol_id?: string;
}