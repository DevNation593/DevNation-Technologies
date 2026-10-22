interface ListFiltersProps {
  q?: string;
  status?: string;
  statuses: { value: string; label: string }[];
  placeholder: string;
}

/** Formulario GET: los filtros viven en la URL y la página se renderiza en el servidor. */
export default function ListFilters({ q, status, statuses, placeholder }: ListFiltersProps) {
  return (
    <form className="adm-filters" method="get">
      <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label="Buscar" />
      <select name="status" defaultValue={status ?? ""} aria-label="Estado">
        <option value="">Todos los estados</option>
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-secondary">
        Filtrar
      </button>
    </form>
  );
}
