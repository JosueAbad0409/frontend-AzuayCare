export interface TipoFormulario {
  id: string;
  nombre: string;
  descripcion?: string | null;
  icono?: string | null;
  color?: string | null;
  created_at?: string;
}

export interface CreateTipoFormularioDto {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
}

export type UpdateTipoFormularioDto = Partial<CreateTipoFormularioDto>;