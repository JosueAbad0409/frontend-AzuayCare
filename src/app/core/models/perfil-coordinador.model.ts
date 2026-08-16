export interface PerfilCoordinador {
  id?: string;
  usuario_id: string;
  titulo_profesional: string;
  ubicacion_oficina: string;
  horario_atencion: string;
  telefono_contacto: string;
  correo_contacto?: string;
  mensaje_ayuda_estudiantes?: string;
}