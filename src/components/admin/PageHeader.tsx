import Link from "next/link";

interface PageHeaderProps {
  title: string;
  crumbs?: { href: string; label: string }[];
  children?: React.ReactNode;
}

export default function PageHeader({ title, crumbs, children }: PageHeaderProps) {
  return (
    <header className="adm-topbar">
      <div className="adm-topbar-inner">
        <div>
          {crumbs && crumbs.length > 0 && (
            <div className="crumb">
              {crumbs.map((c, i) => (
                <span key={c.href}>
                  {i > 0 && " / "}
                  <Link href={c.href}>{c.label}</Link>
                </span>
              ))}
            </div>
          )}
          <h1>{title}</h1>
        </div>
        {children && <div className="adm-actions">{children}</div>}
      </div>
    </header>
  );
}
