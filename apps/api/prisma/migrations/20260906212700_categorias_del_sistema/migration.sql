-- Categorias base, compartidas por todos los usuarios (userId nulo).
--
-- Van en una migracion y no en un script de seed aparte para que existan en
-- todos los entornos sin ningun paso manual: si faltaran en produccion, el
-- alta de un servicio se quedaria sin categorias donde elegir.
--
-- Los identificadores son fijos a proposito: asi la misma categoria tiene el
-- mismo id en desarrollo y en produccion, y un servicio exportado de un
-- entorno se puede importar en otro sin remapear nada.
INSERT INTO "categories" ("id", "userId", "name", "slug", "icon", "colorHex", "isSystem", "sortOrder", "createdAt")
VALUES
  ('00000000-0000-4000-8000-000000000001', NULL, 'Internet',     'internet',     'wifi',            '#0288D1', true,  10, NOW()),
  ('00000000-0000-4000-8000-000000000002', NULL, 'Teléfono',     'telefono',     'phone',           '#00838F', true,  20, NOW()),
  ('00000000-0000-4000-8000-000000000003', NULL, 'Electricidad', 'electricidad', 'bolt',            '#F9A825', true,  30, NOW()),
  ('00000000-0000-4000-8000-000000000004', NULL, 'Gas',          'gas',          'local_fire_dept', '#EF6C00', true,  40, NOW()),
  ('00000000-0000-4000-8000-000000000005', NULL, 'Agua',         'agua',         'water_drop',      '#0277BD', true,  50, NOW()),
  ('00000000-0000-4000-8000-000000000006', NULL, 'Salud',        'salud',        'favorite',        '#C62828', true,  60, NOW()),
  ('00000000-0000-4000-8000-000000000007', NULL, 'Streaming',    'streaming',    'play_circle',     '#6A1B9A', true,  70, NOW()),
  ('00000000-0000-4000-8000-000000000008', NULL, 'Seguros',      'seguros',      'shield',          '#2E7D32', true,  80, NOW()),
  ('00000000-0000-4000-8000-000000000009', NULL, 'Vivienda',     'vivienda',     'home',            '#5D4037', true,  90, NOW()),
  ('00000000-0000-4000-8000-00000000000a', NULL, 'Educación',    'educacion',    'school',          '#1565C0', true, 100, NOW()),
  ('00000000-0000-4000-8000-00000000000b', NULL, 'Tarjetas',     'tarjetas',     'credit_card',     '#37474F', true, 110, NOW()),
  ('00000000-0000-4000-8000-00000000000c', NULL, 'Impuestos',    'impuestos',    'account_balance', '#4E342E', true, 120, NOW()),
  ('00000000-0000-4000-8000-00000000000d', NULL, 'Otros',        'otros',        'category',        '#616161', true, 999, NOW())
ON CONFLICT ("id") DO NOTHING;
