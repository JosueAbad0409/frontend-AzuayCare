export interface PerfilAyudaContacto {
  id: string;
  nombreCompleto: string;
  cargo: string | null;
  mensajeAyuda: string | null;
  correo: string | null;
  telefono: string | null;
  horarioAtencion: string | null;
  ubicacion: string | null;
  fotoUrl: string | null;
}

export interface AyudaEstudianteResponse {
  bienestarEstudiantil: PerfilAyudaContacto | null;
  coordinadoresCarrera: PerfilAyudaContacto[];
}