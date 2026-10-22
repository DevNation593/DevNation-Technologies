/* eslint-disable @next/next/no-img-element -- el logo es un data URL guardado en la configuración */

export default function CompanyLogo({ src, className = "doc-logo" }: { src: string; className?: string }) {
  return <div className={className}>{src ? <img src={src} alt="Logo" /> : "DN"}</div>;
}
