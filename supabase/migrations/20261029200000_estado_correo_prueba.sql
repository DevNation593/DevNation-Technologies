-- El botón «Enviar correo de prueba» debe confirmar que Resend aceptó el correo.
-- send_certificate_test_email pasa a devolver el id de la petición de pg_net y
-- certificate_test_email_status permite consultar su respuesta.

-- Cambia el tipo de retorno (void → bigint): hay que recrear la función.
drop function public.send_certificate_test_email();

-- SECURITY DEFINER: necesita leer Vault y auth.users, que el rol authenticated no
-- puede leer. Por eso lo primero es comprobar que quien llama es administrador.
create function public.send_certificate_test_email()
returns bigint
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
    return private.send_alert_email(email_subject, private.certificate_alert_html(email_subject, cert));
  end if;
  return private.send_alert_email(
    email_subject,
    '<p style="font-family:Arial,sans-serif;font-size:14px">Los avisos por correo funcionan. '
    'Aún no hay una firma electrónica subida en el panel.</p>'
  );
end;
$$;

-- Estado de una petición de correo: pending (en cola), sent (2xx), error (con mensaje)
-- o unknown (sin fila: id inexistente o respuesta ya borrada por pg_net.ttl).
-- SECURITY DEFINER: net._http_response no es legible para authenticated por diseño;
-- solo devuelve el estado y el mensaje de error de Resend, nunca las cabeceras de la petición.
create function public.certificate_test_email_status(request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response net._http_response%rowtype;
  message text;
begin
  if not private.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into response from net._http_response where id = request_id;
  if not found then
    if exists (select 1 from net.http_request_queue where id = request_id) then
      return jsonb_build_object('status', 'pending');
    end if;
    return jsonb_build_object('status', 'unknown');
  end if;

  if response.status_code between 200 and 299 then
    return jsonb_build_object('status', 'sent');
  end if;
  if response.status_code is null then
    return jsonb_build_object('status', 'error', 'message', 'No se pudo conectar con el servicio de correo.');
  end if;

  begin
    message := nullif(trim(response.content::jsonb ->> 'message'), '');
  exception when others then
    message := null;  -- La respuesta no es JSON (p. ej. una página de error).
  end;
  return jsonb_build_object(
    'status', 'error',
    'message', left(coalesce(message, format('El servicio de correo respondió con un error (%s).', response.status_code)), 300)
  );
end;
$$;

revoke execute on function public.send_certificate_test_email() from public, anon;
grant execute on function public.send_certificate_test_email() to authenticated;
revoke execute on function public.certificate_test_email_status(bigint) from public, anon;
grant execute on function public.certificate_test_email_status(bigint) to authenticated;
