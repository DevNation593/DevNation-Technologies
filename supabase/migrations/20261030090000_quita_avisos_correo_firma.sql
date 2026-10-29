-- El aviso de caducidad de la firma electrónica queda solo en el panel (banner
-- en todas las páginas). Se quitan los avisos por correo con Resend: la tarea
-- pg_cron, las funciones de envío, el correo de prueba y las columnas de
-- seguimiento. Las extensiones pg_cron y pg_net se dejan instaladas.
-- Los secretos de Vault (resend_api_key, alert_from_email) se borran a mano.

select cron.unschedule(jobid) from cron.job where jobname = 'aviso-caducidad-firma';

drop function if exists public.certificate_test_email_status(bigint);
drop function if exists public.send_certificate_test_email();
drop function if exists private.notify_certificate_expiry(timestamptz);
drop function if exists private.send_alert_email(text, text);
drop function if exists private.certificate_alert_html(text, public.sri_certificates);
drop function if exists private.certificate_days_left(timestamptz, timestamptz);
drop function if exists private.escape_html(text);

alter table public.sri_certificates
  drop column if exists notified_days,
  drop column if exists pending_alert_request_id,
  drop column if exists pending_alert_day;
