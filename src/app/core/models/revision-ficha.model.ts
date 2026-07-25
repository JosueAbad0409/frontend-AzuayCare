export interface FichaRevision {
  id: string;
  usuario_id: string;
  periodo_id: string;
  formulario_id: string;
  total_ingresos: number;
  total_egresos: number;
  balance_final: number;
  nivel_economico_id: string | null;
  estado_ficha: 'BORRADOR' | 'ENVIADO' | 'VALIDADO' | 'RECHAZADO';
  created_at: string;
  updated_at: string;
  usuario?: {
    id: string;
    primer_nombre: string;
    primer_apellido: string;
    segundo_nombre?: string | null;
    segundo_apellido?: string | null;
    email_institucional: string;
    cedula: string | null;
  };
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
}