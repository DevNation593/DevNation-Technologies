-- Panel administrativo de DevNation: clientes, cotizaciones, contratos y
-- facturación electrónica SRI. Solo los usuarios registrados en
-- public.admin_users (creados con `npm run admin:create-user`) pueden leer o
-- modificar estos datos.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Usuarios administradores
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Cada administrador ve su propio registro"
  on public.admin_users for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- SECURITY INVOKER: la política anterior permite al usuario ver su propia fila,
-- por lo que no hace falta saltarse RLS.
create function private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Datos del emisor (fila única)
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id smallint primary key default 1 check (id = 1),
  ruc text not null default '' check (ruc = '' or ruc ~ '^[0-9]{13}$'),
  razon_social text not null default 'DevNation Technologies',
  nombre_comercial text not null default 'DevNation Technologies',
  dir_matriz text not null default 'Quito, Ecuador',
  dir_establecimiento text not null default '',
  estab text not null default '001' check (estab ~ '^[0-9]{3}$'),
  pto_emi text not null default '001' check (pto_emi ~ '^[0-9]{3}$'),
  ambiente smallint not null default 1 check (ambiente in (1, 2)),
  obligado_contabilidad boolean not null default false,
  contribuyente_especial text not null default '',
  agente_retencion text not null default '',
  regimen text not null default 'GENERAL'
    check (regimen in ('GENERAL', 'RIMPE_EMPRENDEDOR', 'RIMPE_NEGOCIO_POPULAR')),
  representante_legal text not null default '',
  email text not null default '',
  telefono text not null default '',
  ciudad text not null default 'Quito, Ecuador',
  logo_data_url text not null default ''
    check (length(logo_data_url) <= 400000),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (1);

create trigger company_settings_updated_at
  before update on public.company_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Numeración de documentos
-- ---------------------------------------------------------------------------

create table public.document_sequences (
  key text primary key,
  last_value integer not null check (last_value >= 0),
  updated_at timestamptz not null default now()
);

-- Reserva atómicamente el siguiente número de una serie
-- (p. ej. 'cotizacion:2026' o 'factura:1:001-001').
create function public.next_document_number(p_key text)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.document_sequences as s (key, last_value)
  values (p_key, 1)
  on conflict (key) do update
    set last_value = s.last_value + 1,
        updated_at = now()
  returning last_value;
$$;

revoke execute on function public.next_document_number(text) from public, anon;
grant execute on function public.next_document_number(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  -- Códigos SRI: 04 RUC, 05 cédula, 06 pasaporte, 07 consumidor final, 08 exterior.
  identification_type text not null check (identification_type in ('04', '05', '06', '07', '08')),
  identification text not null check (length(identification) between 3 and 20),
  name text not null check (length(name) between 1 and 300),
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  legal_representative text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identification_type, identification)
);

create index clients_name_idx on public.clients (name);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Cotizaciones (proformas)
-- ---------------------------------------------------------------------------

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  status text not null default 'borrador'
    check (status in ('borrador', 'enviada', 'aceptada', 'rechazada', 'facturada')),
  issue_date date not null default ((now() at time zone 'America/Guayaquil')::date),
  valid_days integer not null default 15 check (valid_days between 1 and 365),
  currency text not null default 'USD' check (currency in ('USD', 'EUR')),
  client_id uuid references public.clients (id) on delete set null,
  client jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  tax_rate numeric(5, 2) not null default 15 check (tax_rate >= 0),
  discount_rate numeric(5, 2) not null default 0 check (discount_rate between 0 and 100),
  payment_terms text not null default '',
  delivery_time text not null default '',
  notes text not null default '',
  subtotal numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_created_at_idx on public.quotes (created_at desc);
create index quotes_client_id_idx on public.quotes (client_id);

create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------------

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null default 'software'
    check (kind in ('software', 'saas', 'support', 'consult', 'nda')),
  status text not null default 'borrador'
    check (status in ('borrador', 'enviado', 'firmado', 'finalizado', 'anulado')),
  contract_date date not null default ((now() at time zone 'America/Guayaquil')::date),
  client_id uuid references public.clients (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  -- Campos del formulario del generador (partes, alcance, cláusulas, etc.).
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  total numeric(14, 2) not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_created_at_idx on public.contracts (created_at desc);
create index contracts_client_id_idx on public.contracts (client_id);
create index contracts_quote_id_idx on public.contracts (quote_id);

create trigger contracts_updated_at
  before update on public.contracts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Facturas electrónicas
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'borrador'
    check (status in ('borrador', 'enviada', 'autorizada', 'devuelta', 'no_autorizada', 'anulada')),
  quote_id uuid references public.quotes (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  buyer jsonb not null default '{}'::jsonb check (jsonb_typeof(buyer) = 'object'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  payments jsonb not null default '[]'::jsonb check (jsonb_typeof(payments) = 'array'),
  additional_info jsonb not null default '[]'::jsonb check (jsonb_typeof(additional_info) = 'array'),
  issue_date date not null default ((now() at time zone 'America/Guayaquil')::date),
  -- Se asignan al emitir y no cambian aunque el SRI devuelva el comprobante.
  ambiente smallint check (ambiente in (1, 2)),
  estab text check (estab ~ '^[0-9]{3}$'),
  pto_emi text check (pto_emi ~ '^[0-9]{3}$'),
  secuencial text check (secuencial ~ '^[0-9]{9}$'),
  access_key text unique check (access_key ~ '^[0-9]{49}$'),
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  signed_xml text,
  authorized_xml text,
  authorization_number text,
  authorized_at timestamptz,
  sri_messages jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ambiente, estab, pto_emi, secuencial)
);

create index invoices_created_at_idx on public.invoices (created_at desc);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_quote_id_idx on public.invoices (quote_id);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function private.set_updated_at();

-- Un comprobante autorizado por el SRI es inmutable: solo puede marcarse como
-- anulado (la anulación en sí se realiza en el portal del SRI).
create function private.protect_authorized_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.access_key is not null then
      raise exception 'No se puede eliminar una factura que ya tiene clave de acceso.';
    end if;
    return old;
  end if;

  if old.status in ('autorizada', 'anulada') then
    if new.status not in ('autorizada', 'anulada')
      or new.buyer is distinct from old.buyer
      or new.items is distinct from old.items
      or new.payments is distinct from old.payments
      or new.additional_info is distinct from old.additional_info
      or new.issue_date is distinct from old.issue_date
      or new.access_key is distinct from old.access_key
      or new.secuencial is distinct from old.secuencial
      or new.total is distinct from old.total
      or new.authorized_xml is distinct from old.authorized_xml then
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

create trigger invoices_protect_authorized
  before update or delete on public.invoices
  for each row execute function private.protect_authorized_invoice();

-- ---------------------------------------------------------------------------
-- Acceso: las tablas nuevas no se exponen automáticamente al Data API, así que
-- se conceden permisos explícitos solo al rol authenticated y RLS restringe a
-- los administradores.
-- ---------------------------------------------------------------------------

revoke all on public.admin_users, public.company_settings, public.document_sequences,
  public.clients, public.quotes, public.contracts, public.invoices from anon;

grant select on public.admin_users to authenticated;
grant select, update on public.company_settings to authenticated;
grant select, insert, update on public.document_sequences to authenticated;
grant select, insert, update, delete on public.clients, public.quotes, public.contracts,
  public.invoices to authenticated;

alter table public.company_settings enable row level security;
alter table public.document_sequences enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;

create policy "Administradores leen la configuración"
  on public.company_settings for select to authenticated
  using ((select private.is_admin()));
create policy "Administradores actualizan la configuración"
  on public.company_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Administradores gestionan la numeración"
  on public.document_sequences for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Administradores gestionan clientes"
  on public.clients for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Administradores gestionan cotizaciones"
  on public.quotes for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Administradores gestionan contratos"
  on public.contracts for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Administradores gestionan facturas"
  on public.invoices for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
