export interface EstudiantePerfil {
  cedula: string;
  rol: 'ESTUDIANTE' | 'INVITADO';
  correo: string;
  carrera: string;
  ciclo: string;
  periodoAcademico: string;
  estadoMatricula: 'MATRICULADO' | 'PENDIENTE' | 'PREMATRICULADO' | 'INACTIVO';
}