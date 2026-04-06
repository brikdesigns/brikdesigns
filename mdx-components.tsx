import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import '@/app/blog/blog-typography.css';

function MdxWrapper({ children }: { children: ReactNode }) {
  return <div className="mdx">{children}</div>;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    wrapper: MdxWrapper,
    a: ({ href, ref: _ref, ...props }) => {
      const target = href || '';
      if (target.startsWith('/') || target.startsWith('#')) {
        return <Link href={target} {...props} />;
      }
      return <a href={target} target="_blank" rel="noopener noreferrer" {...props} />;
    },
    img: ({ src, alt }) => (
      <Image
        src={src || ''}
        alt={alt || ''}
        width={800}
        height={450}
      />
    ),
    ...components,
  };
}
