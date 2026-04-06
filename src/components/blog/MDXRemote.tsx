import { MDXRemote as MDXRemoteBase } from 'next-mdx-remote/rsc';
import Image from 'next/image';
import Link from 'next/link';
import '@/app/blog/blog-typography.css';

const components = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = props.href || '';
    if (href.startsWith('/') || href.startsWith('#')) {
      return <Link href={href} {...props} />;
    }
    return <a target="_blank" rel="noopener noreferrer" {...props} />;
  },
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <Image
      src={String(props.src || '')}
      alt={props.alt || ''}
      width={720}
      height={405}
    />
  ),
};

export function MDXRemote({ source }: { source: string }) {
  return (
    <div className="mdx">
      <MDXRemoteBase source={source} components={components} />
    </div>
  );
}
