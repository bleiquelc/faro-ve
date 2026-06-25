-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_indexes.sql — índices para búsqueda eficiente y mapa
-- ─────────────────────────────────────────────────────────────────────────────

-- Búsqueda geoespacial: GIST sobre obfuscated (público) y point (admin)
create index if not exists persons_loc_obfuscated_gist
  on persons using gist (last_known_location_obfuscated);

create index if not exists persons_loc_point_gist
  on persons using gist (last_known_location_point);

create index if not exists notes_sighting_obfuscated_gist
  on notes using gist (sighting_location_obfuscated);

-- Búsqueda fuzzy de nombres (pg_trgm)
create index if not exists persons_full_name_trgm
  on persons using gin (full_name_normalized gin_trgm_ops);

create index if not exists persons_marks_trgm
  on persons using gin (distinguishing_marks gin_trgm_ops);

-- Cola moderación
create index if not exists persons_pending_priority
  on persons (moderation_status, ai_priority desc, medical_urgent desc, is_minor desc, created_at asc)
  where moderation_status = 'pending' and withdrawn_at is null;

-- Mapa público (filtra approved + no withdrawn)
create index if not exists persons_public_filter
  on persons (status, is_minor, medical_urgent, moderation_status)
  where moderation_status = 'approved' and withdrawn_at is null;

-- Foreign / lookups
create index if not exists persons_source_lookup
  on persons (source, source_id);

create unique index if not exists persons_source_id_unique
  on persons (source, source_id)
  where source_id is not null;

create index if not exists persons_client_uuid_idx
  on persons (client_uuid)
  where client_uuid is not null;

create index if not exists persons_pfif_id_idx
  on persons (pfif_id);

create index if not exists persons_status_idx
  on persons (status) where withdrawn_at is null;

create index if not exists persons_last_seen_idx
  on persons (last_seen_at desc nulls last);

create index if not exists persons_reporter_email_hash_idx
  on persons (reporter_email_hash);

-- Notes
create index if not exists notes_person_id_idx
  on notes (person_id, created_at desc);

create index if not exists notes_type_idx
  on notes (type, moderation_status);

create index if not exists notes_sighting_date_idx
  on notes (sighting_date desc nulls last)
  where type = 'sighting';

-- Links
create index if not exists links_source_idx
  on links (source_person_id, type, confidence desc);

create index if not exists links_target_idx
  on links (target_person_id, type, confidence desc);

-- Messages
create index if not exists messages_person_idx
  on messages (person_id, created_at desc);

create index if not exists messages_sender_ip_window_idx
  on messages (sender_ip_hashed, created_at desc);

-- Searches active
create index if not exists searches_active_area_gist
  on searches_active using gist (area);

create index if not exists searches_active_window_idx
  on searches_active (starts_at, ends_at);
