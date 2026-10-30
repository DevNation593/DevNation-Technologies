/** Peso máximo del archivo del logo (1 MB). */
export const MAX_LOGO_BYTES = 1024 * 1024;

/**
 * Largo máximo del data URL del logo: el base64 ocupa 4/3 del archivo, más el prefijo
 * `data:image/…;base64,`. Debe caber en el check de company_settings.logo_data_url.
 */
export const MAX_LOGO_DATA_URL_LENGTH = Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 32;
