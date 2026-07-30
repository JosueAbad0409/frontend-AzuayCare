export interface CoordinadorCarreraAsignacion {
  id?: string;
  usuario_id: string;
  carrera_id: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  usuario?: {
    primer_nombre: string;
    primer_apellido: string;
    email_institucional: string;
  };
  carrera?: {
    nombre: string;
  };
}

export interface CreateCoordinadorCarreraDto {
  usuario_id: string;
  carrera_id: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}
