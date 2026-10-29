-- Envío de facturas por correo (RIDE en PDF + XML) con Resend.
-- La API key va en la variable de servidor RESEND_API_KEY; aquí solo se guarda
-- la configuración del remitente y el registro del último envío.

alter table public.company_settings
  add column invoice_email_enabled boolean not null default false,
  add column invoice_email_from text not null default '',
  add column invoice_email_reply_to text not null default '',
  add column invoice_email_bcc text not null default '';

-- private.protect_authorized_invoice solo compara columnas fiscales, así que
-- estas columnas se pueden actualizar también en facturas autorizadas.
alter table public.invoices
  add column last_emailed_at timestamptz,
  add column last_emailed_to text,
  add column last_email_error text;
