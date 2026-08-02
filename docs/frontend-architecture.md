# Arquitectura frontend refactorizada

## 1. Estructura propuesta (Atomic Design)

- Átomos
  - botones, inputs, badges, tarjetas, iconos, estados de carga
- Moléculas
  - filtros de reporte, tarjetas KPI, tablas responsive, bloques de acción
- Organismos
  - panel de reportes, hero del dashboard, sección de métricas, resumen por pregunta
- Plantillas
  - layout administrativo, vistas de módulos, páginas con hero + métricas + acciones

## 2. Arquitectura de archivos

src/
  app/
    core/
      design/
        tokens.css
        theme.css
        utilities.css
      services/
      models/
    features/
      admin/
        dashboard/
        reportes/
        shared/
    shared/
      components/
        ui/

## 3. Estrategia de rendimiento

- CSS global y tokens centralizados para reducir duplicación y mejorar consistencia.
- Skeleton screens y layout estable para mejorar la percepción de carga.
- Componentes pesados cargados de forma perezosa cuando sea posible.
- Transiciones con `transform` y `opacity` para evitar repaints costosos.
- Uso de clases compartidas para botones, cards, formularios y tablas.

## 4. Snippet comparativo: antes vs después

### Antes
```html
<div class="filters-card">
  <select class="form-control">...</select>
</div>
```

```css
.filters-card {
  background: #fff;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
}
```

### Después
```html
<section class="filters-card surface-card--soft">
  <form class="form-grid">
    <div class="form-group">...</div>
  </form>
</section>
```

```css
.surface-card,
.filters-card {
  background: var(--surface-0);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
}
```

## 5. Recomendaciones de continuidad

- Migrar a un sistema de diseño compartido con componentes standalone reutilizables.
- Añadir soporte semántico para dark mode vía un toggle global.
- Introducir un store ligero para filtros y estado de UI si el sistema crece.
