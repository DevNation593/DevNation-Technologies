-- El logo y los XML de las facturas pasan de columnas de texto a Supabase Storage.
--
-- · branding (público): el logo de la empresa, que se muestra en los documentos y en
--   el PDF de la factura. Solo los administradores pueden subirlo o borrarlo.
-- · facturas (privado): XML firmado y XML autorizado de cada factura, en
--   `<id de la factura>/<clave de acceso>-firmada.xml` y `-autorizada.xml`. El XML
--   autorizado no se puede reemplazar ni borrar, y su hash queda en la factura.
--
-- Las columnas logo_data_url, signed_xml y authorized_xml se conservan para los datos
-- anteriores hasta pasarlos a Storage con `npm run storage:migrate`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding', 'branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('facturas', 'facturas', false, 5242880, array['application/xml'])
on conflict (id) do nothing;

create policy "Administradores leen el logo"
  on storage.objects for select to authenticated
  using (bucket_id = 'branding' and (select private.is_admin()));
create policy "Administradores suben el logo"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (select private.is_admin()));
create policy "Administradores borran el logo"
  on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (select private.is_admin()));

create policy "Administradores leen los XML de las facturas"
  on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and (select private.is_admin()));
create policy "Administradores suben los XML de las facturas"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas' and (select private.is_admin()));
-- Solo el XML firmado se reemplaza (al reenviar una factura devuelta con la misma clave).
-- No hay política de borrado: una factura con clave de acceso tampoco se puede borrar.
create policy "Administradores reemplazan el XML firmado"
  on storage.objects for update to authenticated
  using (bucket_id = 'facturas' and name like '%-firmada.xml' and (select private.is_admin()))
  with check (bucket_id = 'facturas' and name like '%-firmada.xml' and (select private.is_admin()));

alter table public.company_settings
  add column logo_path text not null default ''
    check (logo_path = '' or logo_path ~ '^logo/[0-9a-f-]{36}\.(png|jpg|webp|svg)$');

alter table public.invoices
  add column signed_xml_path text,
  add column authorized_xml_path text,
  add column authorized_xml_sha256 text check (authorized_xml_sha256 ~ '^[0-9a-f]{64}$');

-- Igual que antes, pero el XML autorizado se protege por su ruta y hash en Storage.
-- La única excepción es pasarlo de la columna authorized_xml a Storage: la ruta y el
-- hash se fijan una sola vez y el hash debe coincidir con el XML que había.
create or replace function private.protect_authorized_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  moved_to_storage boolean;
begin
  if tg_op = 'DELETE' then
    if old.access_key is not null then
      raise exception 'No se puede eliminar una factura que ya tiene clave de acceso.';
    end if;
    return old;
  end if;

  if old.status in ('autorizada', 'anulada') then
    moved_to_storage := old.authorized_xml is not null
      and new.authorized_xml is null
      and old.authorized_xml_path is null
      and new.authorized_xml_path is not null
      and new.authorized_xml_sha256 = encode(sha256(convert_to(old.authorized_xml, 'UTF8')), 'hex');

    if new.status not in ('autorizada', 'anulada')
      or new.buyer is distinct from old.buyer
      or new.items is distinct from old.items
      or new.payments is distinct from old.payments
      or new.additional_info is distinct from old.additional_info
      or new.issue_date is distinct from old.issue_date
      or new.access_key is distinct from old.access_key
      or new.secuencial is distinct from old.secuencial
      or new.total is distinct from old.total
      or (not moved_to_storage and (
        new.authorized_xml is distinct from old.authorized_xml
        or new.authorized_xml_path is distinct from old.authorized_xml_path
        or new.authorized_xml_sha256 is distinct from old.authorized_xml_sha256
      )) then
      raise exception 'La factura % ya fue autorizada y no puede modificarse.', old.access_key;
    end if;
  end if;

  -- La numeración es fija, salvo para reemitir un comprobante NO AUTORIZADO,
  -- cuya clave de acceso ya no puede reutilizarse.
  if old.access_key is not null and old.status <> 'no_autorizada' and (
    new.access_key is distinct from old.access_key
    or new.secuencial is distinct from old.secuencial
    or new.ambiente is distinct from old.ambiente
    or new.issue_date is distinct from old.issue_date
  ) then
    raise exception 'La numeración de un comprobante emitido no puede cambiar.';
  end if;

  return new;
end;
$$;
