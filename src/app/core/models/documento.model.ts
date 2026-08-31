export interface DocumentoRespaldo {
  id: string;
  usuario_id: string; // Añadido
  respuesta_id: string | null;
  ficha_id: string | null;
  perfil_periodo_id: string | null; // Presente en la entidad del backend, faltaba aquí
  ruta_archivo: string; // Aquí ya viene la URL pública completa de Supabase
  nombre_original: string;
  mime_type: string;
  tamanio_bytes: number;
  verificado: boolean | null; // Ahora puede ser null
  fecha_verificacion: string | null;
  usuario_verificador: string | null;
  observacion: string | null;
  created_at: string;
  updated_at: string;
  fecha_desactivacion: string | null;

  // Relaciones opcionales que llegan pobladas solo cuando el backend
  // las incluye explícitamente (ej. en findByUsuario con `relations`).
  ficha?: {
    periodo?: {
      nombre: string;
    } | null;
  } | null;
  respuesta?: {
    ficha?: {
      periodo?: {
        nombre: string;
      } | null;
    } | null;
  } | null;
}