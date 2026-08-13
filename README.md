# AzuayCare - Frontend

Sistema de gestión de fichas socioeconómicas y de bienestar estudiantil de la **Universidad del Azuay**.

Frontend desarrollado en **Angular** con arquitectura de standalone components y signals. Permite a los estudiantes completar fichas socioeconómicas dinámicas y a los coordinadores administrar formularios, revisar fichas, generar reportes y gestionar usuarios.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Roles del sistema](#roles-del-sistema)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecución](#ejecución)
- [Rutas principales](#rutas-principales)
- [Autenticación](#autenticación)
- [Backend asociado](#backend-asociado)
- [Notas importantes](#notas-importantes)
- [Despliegue sugerido](#despliegue-sugerido)

---

## Características

### Módulo Estudiante / Invitado
- Inicio de sesión con cuenta de Google
- Dashboard de inicio personalizado
- Completar ficha socioeconómica de forma dinámica (secciones, preguntas, matrices)
- Carga y gestión de documentos de respaldo
- Visualización y actualización de perfil

### Módulo Coordinador (Bienestar / Carrera)
- Dashboard administrativo con resumen de información
- Gestión de **Carreras**, **Ciclos** y **Periodos de matrícula**
- **Constructor de formularios (Form Builder)** con:
  - Secciones (Información General / Financiera)
  - Preguntas de tipo: Texto, Numérico, Selección única, Selección múltiple y Matriz
  - Opciones con valor ponderado, dependencias y subpreguntas
  - Rangos calculados de vulnerabilidad / priorización
- Revisión de fichas enviadas por estudiantes
- Gestión de usuarios
- Generación de reportes
- Auditoría de acciones (solo Coordinador de Bienestar)
- Perfil del coordinador

---

## Stack tecnológico

| Tecnología              | Uso                                      |
|-------------------------|------------------------------------------|
| Angular                 | Framework principal (standalone)         |
| Signals                 | Estado reactivo                          |
| Angular Router          | Rutas con lazy loading                   |
| HttpClient + Interceptor| Comunicación con la API                  |
| JWT                     | Autenticación                            |
| Google Identity Services| Login con Google                         |
| CSS                     | Estilos de la aplicación                 |

---

## Roles del sistema

| Rol                        | Acceso principal                                      |
|---------------------------|-------------------------------------------------------|
| `ESTUDIANTE`              | Completar ficha, subir documentos, ver perfil         |
| `INVITADO`                | Acceso limitado similar al estudiante                 |
| `COORDINADOR_CARRERA`     | Administración y revisión de fichas de su carrera     |
| `COORDINADOR_BIENESTAR`   | Acceso completo (incluye módulo de auditoría)         |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── core/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── role.guard.ts
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts
│   │   ├── models/                 # Interfaces y DTOs
│   │   └── services/               # Servicios HTTP
│   ├── features/
│   │   ├── login/
│   │   ├── admin/
│   │   │   ├── layout/
│   │   │   ├── dashboard/
│   │   │   ├── carreras/
│   │   │   ├── ciclos/
│   │   │   ├── periodos/
│   │   │   ├── formularios/
│   │   │   │   └── builder/        # Form Builder + Matriz Builder
│   │   │   ├── revision/
│   │   │   ├── reportes/
│   │   │   ├── usuarios/
│   │   │   ├── auditoria/
│   │   │   └── perfil-coordinador-form/
│   │   └── estudiante/
│   │       ├── layout/
│   │       ├── inicio/
│   │       ├── documentos/
│   │       └── estudiante-ficha.component.*
│   └── shared/
│       └── components/
├── environments/
│   ├── environment.ts              # Producción
│   └── environment.development.ts  # Desarrollo
├── index.html
├── main.ts
├── styles.css
└── _redirects
```

---

## Requisitos previos

- Node.js 18 o superior (recomendado 20+)
- npm o yarn
- Angular CLI (opcional, recomendado):
  ```bash
  npm install -g @angular/cli
  ```

---

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio-frontend>
cd <nombre-carpeta-frontend>

# Instalar dependencias
npm install
```

---

## Configuración

Los archivos de entorno se encuentran en `src/environments/`.

### Desarrollo (`environment.development.ts`)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  googleClientId: '474214477775-m9ci1dg4p6i20s7548et5sfto14750lp.apps.googleusercontent.com'
};
```

### Producción (`environment.ts`)

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://azuaycare-backend.onrender.com',
  googleClientId: '474214477775-m9ci1dg4p6i20s7548et5sfto14750lp.apps.googleusercontent.com'
};
```

> **Importante:** El `googleClientId` debe coincidir con el configurado en Google Cloud Console y el dominio debe estar autorizado.

---

## Ejecución

```bash
# Modo desarrollo (hot reload)
ng serve
# o
npm start

# Especificar puerto (ejemplo usado en CORS del backend)
ng serve --port 8087

# Build de producción
ng build --configuration production

# Servir el build de producción localmente
npx http-server dist/ -p 8087
```

La aplicación normalmente se abre en:
- `http://localhost:4200` (puerto por defecto de Angular)
- o `http://localhost:8087` (puerto configurado en el CORS del backend)

---

## Rutas principales

| Ruta                              | Descripción                          | Roles permitidos                     |
|-----------------------------------|--------------------------------------|--------------------------------------|
| `/login`                          | Inicio de sesión                     | Público                              |
| `/estudiante/inicio`              | Dashboard del estudiante             | ESTUDIANTE, INVITADO                 |
| `/estudiante/ficha`               | Completar / ver ficha                | ESTUDIANTE, INVITADO                 |
| `/estudiante/documentos`          | Documentos de respaldo               | ESTUDIANTE, INVITADO                 |
| `/admin/dashboard`                | Dashboard administrativo             | COORDINADOR_*                        |
| `/admin/carreras`                 | Gestión de carreras                  | COORDINADOR_*                        |
| `/admin/ciclos`                   | Gestión de ciclos                    | COORDINADOR_*                        |
| `/admin/periodos`                 | Periodos de matrícula                | COORDINADOR_*                        |
| `/admin/formularios`              | Listado de formularios               | COORDINADOR_*                        |
| `/admin/formularios/builder/:id`  | Constructor de formularios           | COORDINADOR_*                        |
| `/admin/revision-fichas`          | Revisión de fichas                   | COORDINADOR_*                        |
| `/admin/reportes`                 | Reportes                             | COORDINADOR_*                        |
| `/admin/usuarios`                 | Gestión de usuarios                  | COORDINADOR_*                        |
| `/admin/auditoria`                | Logs de auditoría                    | COORDINADOR_BIENESTAR                |
| `/admin/perfil-coordinador`       | Perfil del coordinador               | COORDINADOR_*                        |

---

## Autenticación

- El login se realiza con **Google**.
- El backend responde con un **JWT**.
- El token se guarda en `localStorage` con la clave:
  ```
  azuaycare_access_token
  ```
- Existe un `auth.interceptor` que añade automáticamente el token a las peticiones HTTP.
- Los guards `authGuard` y `roleGuard` protegen las rutas según el rol del usuario.
- Si el token está expirado, la sesión se cierra automáticamente.

---

## Backend asociado

Este frontend se comunica con el backend NestJS de AzuayCare:

| Entorno     | URL                                      |
|-------------|------------------------------------------|
| Desarrollo  | `http://localhost:3000`                  |
| Producción  | `https://azuaycare-backend.onrender.com` |

---

## Notas importantes

- Toda la aplicación usa **standalone components**.
- Se utiliza **lazy loading** en las rutas principales.
- Los formularios son 100% dinámicos y se construyen desde los datos del backend.
- Existe un archivo `_redirects` pensado para despliegue en Netlify.
- El interceptor y los guards controlan el acceso de forma centralizada.

---

## Despliegue sugerido

Opciones recomendadas:
- **Netlify**
- **Vercel**
- **Firebase Hosting**

Pasos generales:
1. Configurar las variables de entorno de producción.
2. Ejecutar `ng build --configuration production`.
3. Subir la carpeta `dist/` al servicio de hosting.
4. Autorizar el dominio de producción en Google Cloud Console (OAuth Client ID).

---

**AzuayCare** · Universidad del Azuay
