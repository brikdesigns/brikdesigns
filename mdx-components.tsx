import type { MDXComponents } from 'mdx/types';
import Image from 'next/image';
import Link from 'next/link';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => (
      <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', marginTop: 'var(--gap-xl)', marginBottom: 'var(--gap-md)' }} {...props} />
    ),
    h2: (props) => (
      <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', marginTop: 'var(--gap-xl)', marginBottom: 'var(--gap-md)' }} {...props} />
    ),
    h3: (props) => (
      <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)', marginTop: 'var(--gap-lg)', marginBottom: 'var(--gap-sm)' }} {...props} />
    ),
    p: (props) => (
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--gap-md)' }} {...props} />
    ),
    ul: (props) => (
      <ul style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 'var(--padding-lg)', marginBottom: 'var(--gap-md)' }} {...props} />
    ),
    ol: (props) => (
      <ol style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 'var(--padding-lg)', marginBottom: 'var(--gap-md)' }} {...props} />
    ),
    li: (props) => (
      <li style={{ marginBottom: 'var(--gap-xs)' }} {...props} />
    ),
    a: (props) => {
      const href = props.href || '';
      if (href.startsWith('/') || href.startsWith('#')) {
        return <Link href={href} style={{ color: 'var(--text-brand-primary)', textDecoration: 'underline' }} {...props} />;
      }
      return <a style={{ color: 'var(--text-brand-primary)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" {...props} />;
    },
    blockquote: (props) => (
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
    img: (props) => (
      <Image
        src={props.src || ''}
        alt={props.alt || ''}
        width={800}
        height={450}
        style={{ borderRadius: 'var(--border-radius-md)', width: '100%', height: 'auto', marginBottom: 'var(--gap-md)' }}
      />
    ),
    ...components,
  };
}
