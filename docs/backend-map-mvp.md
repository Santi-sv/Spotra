# SPOTRA Backend + Google Maps MVP

## Objetivo

Crear un primer corte real de producto sin romper el frontend actual: SPOTRA mantiene su experiencia visual, suma una capa de datos preparada para Supabase/Postgres/PostGIS y reemplaza el mapa ilustrativo por Google Maps cuando exista una API key restringida.

## Decisiones

- Google Maps se usa como mapa principal y fuente de descubrimiento de lugares existentes.
- SPOTRA conserva su base propia para comunidad, aprobación, reputación, eventos, sponsors y contenido generado por riders.
- Supabase se usa como backend inicial por costo bajo, Auth, Postgres, PostGIS, Storage y RLS.
- Las keys públicas viven en `config.js`. La key de Google debe estar restringida por dominio y APIs desde Google Cloud.
- Si no hay keys, la app usa datos mock y no rompe producción.
- Los permisos admin se leen desde `auth.jwt().app_metadata.role = admin`; no se debe confiar en metadata editable por el usuario.

## Corte MVP

- Tabla `places` para lugares aprobados visibles en el mapa.
- Tabla `place_submissions` para spots, skateparks y tiendas pendientes de aprobación.
- Tabla `events` para competencias asociadas a lugares.
- Mapa Google opcional en la pantalla `Mapa`.
- Búsqueda de Google Places desde el input del mapa cuando la API esté activa.
- Botón `Cómo llegar` con URL de Google Maps.

## Cost Control

- No cargar Google Maps fuera de la pantalla `Mapa`.
- No hacer búsquedas automáticas por movimiento del mapa.
- Usar Places solo por intención explícita del usuario.
- Cachear `place_id` y metadatos propios en Supabase.
- Usar RLS para evitar backend propio al comienzo.
