interface PageTitleProps {
  title: React.ReactNode;
}

export function PageTitle({ title }: PageTitleProps) {
  return (
    <h1 className="ioc-kicker truncate px-6 py-2">
      {title}
    </h1>
  );
}
