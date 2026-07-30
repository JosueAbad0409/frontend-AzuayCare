export interface DocumentoEstudiante {
  id: string;
  nombreOriginal: string;
  tipoDocumento: string; // ej. 'CEDULA', 'PLANILLA_LUZ', 'INGRESOS'
  url: string;
  tamanoBytes: number;
  formato: string; // 'pdf', 'jpg', 'png'
  fechaSubida: Date;
}