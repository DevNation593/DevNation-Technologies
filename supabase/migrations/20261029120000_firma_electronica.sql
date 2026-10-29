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

-- ---------------------------------------------------------------------------
-- Avisos de caducidad por correo (pg_cron + pg_net + Resend)
-- ---------------------------------------------------------------------------
-- Secretos que se crean una sola vez en el SQL Editor (no se versionan):
--   select vault.create_secret('re_...', 'resend_api_key');
--   select vault.create_secret('DevNation <avisos@devnation.tech>', 'alert_from_email');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function private.escape_html(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(coalesce(value, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- Días de calendario en Ecuador entre `as_of` y el vencimiento (negativo si ya pasó).
create function private.certificate_days_left(valid_to timestamptz, as_of timestamptz default now())
returns integer
language sql
stable
set search_path = ''
as $$
  select (valid_to at time zone 'America/Guayaquil')::date - (as_of at time zone 'America/Guayaquil')::date;
$$;

create function private.certificate_alert_html(heading text, cert public.sri_certificates)
returns text
language sql
stable
set search_path = ''
as $$
  select format(
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">'
    '<h2 style="font-size:18px;margin:0 0 12px">%s</h2>'
    '<p>Titular: <strong>%s</strong><br>Emitida por: %s<br>Válida hasta: <strong>%s</strong></p>'
    '<p>Sube la firma renovada en <a href="https://devnation.tech/admin/configuracion">Configuración → Firma '
    'electrónica</a> para seguir emitiendo facturas.</p>'
    '<p style="color:#64748b;font-size:12px">Aviso automático del panel administrativo de DevNation Technologies.</p>'
    '</div>',
    private.escape_html(heading),
    private.escape_html(cert.subject),
    private.escape_html(cert.issuer),
    to_char(cert.valid_to at time zone 'America/Guayaquil', 'DD/MM/YYYY')
  );
$$;

-- Encola el correo en pg_net para todos los administradores y devuelve el id de la petición.
create function private.send_alert_email(subject text, html text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  api_key text;
  sender text;
  recipients text[];
begin
  select array_agg(u.email order by u.email) into recipients
  from public.admin_users a
  join auth.users u on u.id = a.user_id
  where coalesce(u.email, '') <> '';
  if recipients is null then
    raise exception 'No hay administradores con correo para enviar el aviso.';
  end if;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if coalesce(api_key, '') = '' then
    raise exception 'Falta el secreto % en Supabase Vault.', 'resend_api_key';
  end if;
  select decrypted_secret into sender from vault.decrypted_secrets where name = 'alert_from_email';
  if coalesce(sender, '') = '' then
    raise exception 'Falta el secreto % en Supabase Vault.', 'alert_from_email';
  end if;

  return net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', sender, 'to', to_jsonb(recipients), 'subject', subject, 'html', html),
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json')
  );
end;
$$;

-- La ejecuta pg_cron cada hora. Cada ejecución hace UNA de dos cosas:
--   1. Si hay una petición pendiente, confirma su respuesta (y desmarca el umbral si Resend falló).
--   2. Si no, envía un correo cuando se alcanza un umbral nuevo, solo entre las 08:00 y las 20:00 de Ecuador.
create function private.notify_certificate_expiry(as_of timestamptz default now())
returns void
language plpgsql
set search_path = ''
as $$
declare
  cert public.sri_certificates%rowtype;
  response net._http_response%rowtype;
  local_hour integer := extract(hour from as_of at time zone 'America/Guayaquil');
  days_left integer;
  due integer[];
  alert_subject text;
begin
  select * into cert from public.sri_certificates where id = 1 for update;
  if not found then
    return;
  end if;

  if cert.pending_alert_request_id is not null then
    select * into response from net._http_response where id = cert.pending_alert_request_id;
    if not found then
      -- Sigue en cola: se revisa en la siguiente ejecución.
      if exists (select 1 from net.http_request_queue where id = cert.pending_alert_request_id) then
        return;
      end if;
      -- pg_net ya borró la respuesta (pg_net.ttl): se da por enviada.
      update public.sri_certificates set pending_alert_request_id = null, pending_alert_day = null where id = 1;
    elsif response.status_code between 200 and 299 then
      update public.sri_certificates set pending_alert_request_id = null, pending_alert_day = null where id = 1;
    else
      update public.sri_certificates
      set notified_days = array_remove(notified_days, pending_alert_day),
          pending_alert_request_id = null,
          pending_alert_day = null
      where id = 1;
    end if;
    return;
  end if;

  if local_hour < 8 or local_hour >= 20 then
    return;
  end if;

  days_left := private.certificate_days_left(cert.valid_to, as_of);
  select coalesce(array_agg(t order by t), '{}') into due
  from unnest(array[30, 15, 7, 1, 0]) as t
  where days_left <= t and not (t = any (cert.notified_days));
  if cardinality(due) = 0 then
    return;
  end if;

  alert_subject := case
    when days_left > 1 then 'La firma electrónica vence en ' || days_left || ' días'
    when days_left = 1 then 'La firma electrónica vence mañana'
    when days_left = 0 then 'La firma electrónica vence hoy'
    else 'La firma electrónica caducó'
  end;

  update public.sri_certificates
  set notified_days = notified_days || due,
      pending_alert_request_id = private.send_alert_email(alert_subject, private.certificate_alert_html(alert_subject, cert)),
      pending_alert_day = due[1]
  where id = 1;
end;
$$;

-- SECURITY DEFINER: necesita leer Vault y auth.users, que el rol authenticated no
-- puede leer. Por eso lo primero es comprobar que quien llama es administrador.
create function public.send_certificate_test_email()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cert public.sri_certificates%rowtype;
  email_subject constant text := 'Correo de prueba: aviso de firma electrónica';
begin
  if not private.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into cert from public.sri_certificates where id = 1;
  if found then
    perform private.send_alert_email(email_subject, private.certificate_alert_html(email_subject, cert));
  else
    perform private.send_alert_email(
      email_subject,
      '<p style="font-family:Arial,sans-serif;font-size:14px">Los avisos por correo funcionan. '
      'Aún no hay una firma electrónica subida en el panel.</p>'
    );
  end if;
end;
$$;

revoke execute on function private.escape_html(text) from public, anon, authenticated;
revoke execute on function private.certificate_days_left(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function private.certificate_alert_html(text, public.sri_certificates) from public, anon, authenticated;
revoke execute on function private.send_alert_email(text, text) from public, anon, authenticated;
revoke execute on function private.notify_certificate_expiry(timestamptz) from public, anon, authenticated;
revoke execute on function public.send_certificate_test_email() from public, anon;
grant execute on function public.send_certificate_test_email() to authenticated;

select cron.schedule('aviso-caducidad-firma', '0 * * * *', $$select private.notify_certificate_expiry()$$);
