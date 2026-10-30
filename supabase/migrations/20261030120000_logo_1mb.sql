-- El logo de la empresa admite archivos de hasta 1 MB (antes 300 KB).
-- Se guarda como data URL en base64: 1 MB ocupa unos 1 398 136 caracteres.

alter table public.company_settings
  drop constraint company_settings_logo_data_url_check,
  add constraint company_settings_logo_data_url_check
    check (length(logo_data_url) <= 1400000);
