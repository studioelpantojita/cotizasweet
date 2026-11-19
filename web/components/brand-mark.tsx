const brandAssets = {
  horizontal: { path: '/brand/eacotiza-horizontal-granate.svg', width: 428, height: 80 },
  compact: { path: '/brand/eacotiza-compacto-granate.svg', width: 252, height: 156 },
} as const;

export function BrandMark({ variant = 'horizontal' }: { variant?: keyof typeof brandAssets }) {
  const { path, width, height } = brandAssets[variant];

  return (
    <picture className={`eacotiza-mark eacotiza-mark--${variant}`} data-brand-mark={variant}>
      <source media="(max-width: 299px)" srcSet="/brand/eacotiza-simbolo-granate.svg" width={78} height={81} />
      <img src={path} width={width} height={height} alt="E&A Cotiza" />
    </picture>
  );
}
