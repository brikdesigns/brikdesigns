import { MDXRemote as MDXRemoteBase } from 'next-mdx-remote/rsc';
import Image from 'next/image';
import Link from 'next/link';

const components = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', marginTop: 'var(--gap-xl)', marginBottom: 'var(--gap-md)' }} {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', marginTop: 'var(--gap-xl)', marginBottom: 'var(--gap-md)' }} {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)', marginTop: 'var(--gap-lg)', marginBottom: 'var(--gap-sm)' }} {...props} />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', marginTop: 'var(--gap-lg)', marginBottom: 'var(--gap-sm)' }} {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--gap-md)' }} {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 'var(--padding-lg)', marginBottom: 'var(--gap-md)' }} {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 'var(--padding-lg)', marginBottom: 'var(--gap-md)' }} {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li style={{ marginBottom: 'var(--gap-xs)' }} {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = props.href || '';
    if (href.startsWith('/') || href.startsWith('#')) {
      return <Link href={href} style={{ color: 'var(--text-brand-primary)', textDecoration: 'underline' }} {...props} />;
    }
    return <a style={{ color: 'var(--text-brand-primary)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" {...props} />;
  },
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      style={{
        borderLeft: '3px solid var(--border-brand-primary)',
        paddingLeft: 'var(--padding-md)',
        margin: 'var(--gap-lg) 0',
        fontStyle: 'italic',
        color: 'var(--text-secondary)',
      }}
      {...props}
    />
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid var(--border-secondary)', margin: 'var(--gap-xl) 0' }} />
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <Image
      src={String(props.src || '')}
      alt={props.alt || ''}
      width={720}
      height={405}
      style={{ borderRadius: 'var(--border-radius-md)', width: '100%', height: 'auto', marginBottom: 'var(--gap-md)' }}
    />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }} {...props} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em {...props} />
  ),
};

export function MDXRemote({ source }: { source: string }) {
  return <MDXRemoteBase source={source} components={components} />;
}
