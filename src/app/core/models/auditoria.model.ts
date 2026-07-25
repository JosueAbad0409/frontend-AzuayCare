export interface LogAuditoria {
  id: string;
  usuarioId: string;
  usuarioNombre?: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  tablaAfectada: string;
  registroId: string;
  datosAnteriores: Record<string, any> | null;
  datosNuevos: Record<string, any> | null;
  ipOrigen?: string;
  createdAt: string;
}