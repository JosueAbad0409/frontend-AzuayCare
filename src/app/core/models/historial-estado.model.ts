export interface HistorialEstadoFicha {
  id: string;
  ficha_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  comentario: string | null;
  cambiado_por?: string | null;
  created_at: string;
  usuario?: {
    primer_nombre: string;
    primer_apellido: string;
    email_institucional: string;
  };
}
