export type EstadoFicha = 'BORRADOR' | 'ENVIADA' | 'ENVIADO' | 'VALIDADO' | 'RECHAZADO' | 'RECHAZADA';

export interface UsuarioRevision {
  id: string;
  primer_nombre: string;
  primer_apellido: string;
  segundo_nombre?: string | null;
  segundo_apellido?: string | null;
  email_institucional: string;
  cedula: string | null;
}

export interface FichaRevision {
  id: string;
  usuario_id: string;
  periodo_id: string;
  formulario_id: string;
  total_ingresos: number;
  total_egresos: number;
  balance_final: number;
  nivel_economico_id: string | null;
  estado_ficha: EstadoFicha;
  nivel_prioridad?: string; // 🔥 NUEVO CAMPO: Viene del motor dinámico
  rango_resultado_id?: string | null;
  created_at: string;
  updated_at: string;
  usuario?: UsuarioRevision;
  periodo?: {
    id: string;
    nombre: string;
  };
  formulario?: {
    id: string;
    titulo: string;
  };
  nivelEconomico?: {
    id: string;
    nombre: string;
  } | null;
  rangoResultado?: {
    id: string;
    nombre: string;
  } | null;
}

export interface FichasPaginadasResponse {
  data: FichaRevision[];
  total: number;
}