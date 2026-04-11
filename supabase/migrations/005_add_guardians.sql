-- Replace mom/dad columns with flexible guardian_1 through guardian_4.
-- Old mom_* and dad_* columns are kept for historical records already in the table.
-- New submissions use guardian_N_* columns.

alter table public.students
  add column if not exists guardian_1_relationship text,
  add column if not exists guardian_1_name         text,
  add column if not exists guardian_1_address      text,
  add column if not exists guardian_1_city         text,
  add column if not exists guardian_1_state        text,
  add column if not exists guardian_1_zip          text,
  add column if not exists guardian_1_cell         text,
  add column if not exists guardian_1_email        text,
  add column if not exists guardian_1_formal_name  text,

  add column if not exists guardian_2_relationship text,
  add column if not exists guardian_2_name         text,
  add column if not exists guardian_2_address      text,
  add column if not exists guardian_2_city         text,
  add column if not exists guardian_2_state        text,
  add column if not exists guardian_2_zip          text,
  add column if not exists guardian_2_cell         text,
  add column if not exists guardian_2_email        text,
  add column if not exists guardian_2_formal_name  text,

  add column if not exists guardian_3_relationship text,
  add column if not exists guardian_3_name         text,
  add column if not exists guardian_3_address      text,
  add column if not exists guardian_3_city         text,
  add column if not exists guardian_3_state        text,
  add column if not exists guardian_3_zip          text,
  add column if not exists guardian_3_cell         text,
  add column if not exists guardian_3_email        text,
  add column if not exists guardian_3_formal_name  text,

  add column if not exists guardian_4_relationship text,
  add column if not exists guardian_4_name         text,
  add column if not exists guardian_4_address      text,
  add column if not exists guardian_4_city         text,
  add column if not exists guardian_4_state        text,
  add column if not exists guardian_4_zip          text,
  add column if not exists guardian_4_cell         text,
  add column if not exists guardian_4_email        text,
  add column if not exists guardian_4_formal_name  text;
