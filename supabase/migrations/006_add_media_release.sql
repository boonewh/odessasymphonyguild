-- Store photo/media release consent alongside the student record.
-- Signed during the B&B membership application so no separate form is needed.

alter table public.students
  add column if not exists media_release_consent   boolean,
  add column if not exists social_media_opt_out    boolean,
  add column if not exists media_release_signature text;
