export interface EstudiantePerfil {
  // Identidad
  cedula?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  correo?: string;
  email_personal?: string;
  rol?: string;
  estadoMatricula?: string;

  // Académico
  carrera?: string;
  ciclo?: string;
  periodoAcademico?: string;

  // Perfil por periodo (perfiles_usuario_periodo)
  numero_celular?: string;
  sexo?: string;
  estado_civil?: string;
  tiene_hijos?: boolean;
  etnia?: string;
  idioma?: string;
  lugar_nacimiento?: string;
  fecha_nacimiento?: string | Date;
  rango_edad?: string;
  nacionalidad?: string;
  esta_embarazada?: boolean | null;
  tiene_discapacidad?: boolean;
  tipo_discapacidad?: string | null;
  zona_residencia?: string;
}