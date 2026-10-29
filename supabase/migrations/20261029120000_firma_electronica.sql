-- Firma electrónica subida desde el panel y avisos de caducidad.
-- El .p12 y su contraseña se guardan cifrados (AES-256-GCM) por la aplicación
-- con SRI_ENCRYPTION_KEY; aquí solo hay texto cifrado y datos públicos del
-- certificado.

-- ---------------------------------------------------------------------------
-- Firma electrónica activa (fila única)
-- ---------------------------------------------------------------------------

create table public.sri_certificates (
  id smallint primary key default 1 check (id = 1),
  -- Formato "v1:<base64(iv|tag|texto cifrado)>" (src/lib/sri/crypto.ts).
  p12_encrypted text not null,
  password_encrypted text not null,
  subject text not null,
  issuer text not null,
  serial_number text not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users (id) on delete set null,
  -- Umbrales de aviso (30, 15, 7, 1, 0 días) ya enviados por correo.
  notified_days integer[] not null default '{}',
  -- Petición de pg_net pendiente de confirmar y el umbral que avisaba.
  pending_alert_request_id bigint,
  pending_alert_day integer
);

alter table public.sri_certificates enable row level security;

revoke all on public.sri_certificates from public, anon;
grant select, insert, update, delete on public.sri_certificates to authenticated;

create policy "Administradores gestionan la firma electrónica"
  on public.sri_certificates for all
  to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
