export interface Carrera {
    id: string;
    nombre: string;
    correo_institucional: string;
    created_at: string;
    updated_at: string;
    fecha_desactivacion: string | null;
}

export interface CreateCarreraDto {
    nombre: string;
    correo_institucional: string;
}