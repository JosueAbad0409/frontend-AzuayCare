import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function cedulaEcuatorianaValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const cedula = control.value;
        if (!cedula || typeof cedula !== 'string' || cedula.length !== 10) {
            return { cedulaInvalida: true };
        }

        const provincia = parseInt(cedula.substring(0, 2), 10);
        if (provincia < 1 || (provincia > 24 && provincia !== 30)) {
            return { cedulaInvalida: true };
        }

        const tercerDigito = parseInt(cedula[2], 10);
        if (tercerDigito >= 6) {
            return { cedulaInvalida: true };
        }

        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;

        for (let i = 0; i < 9; i++) {
            let valor = parseInt(cedula[i], 10) * coeficientes[i];
            if (valor > 9) valor -= 9;
            suma += valor;
        }

        const digitoVerificador = parseInt(cedula[9], 10);
        const decenaSuperior = Math.ceil(suma / 10) * 10;
        let resultado = decenaSuperior - suma;

        if (resultado === 10) resultado = 0;

        return resultado === digitoVerificador ? null : { cedulaInvalida: true };
    };
}