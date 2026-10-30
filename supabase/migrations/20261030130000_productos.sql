-- Catálogo de productos y servicios para agregarlos como ítems de las facturas.
-- La factura copia los datos del producto en sus ítems: editar o borrar un producto
-- no cambia las facturas ya creadas.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  -- codigoPrincipal del detalle de la factura (máximo 25 caracteres en el XSD del SRI).
  code text not null unique check (length(code) between 1 and 25),
  description text not null check (length(description) between 1 and 300),
  -- precioUnitario admite hasta 6 decimales en el XML de la factura.
  unit_price numeric(20, 6) not null default 0 check (unit_price between 0 and 100000000),
  -- Códigos de tarifa de IVA del SRI (ver src/lib/sri/catalogs.ts).
  vat_code text not null default '4' check (vat_code in ('4', '5', '0', '6', '7')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_description_idx on public.products (description);

create trigger products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

revoke all on public.products from anon;
grant select, insert, update, delete on public.products to authenticated;

alter table public.products enable row level security;

create policy "Administradores gestionan productos"
  on public.products for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
