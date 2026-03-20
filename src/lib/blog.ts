import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  duration: string;
  featured: boolean;
  image?: string;
  ctaTitle?: string;
  ctaDescription?: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));

  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data } = matter(raw);
    return {
      slug: file.replace(/\.mdx$/, ''),
      title: data.title || '',
      summary: data.summary || '',
      date: data.date || '',
      category: data.category || '',
      duration: data.duration || '',
      featured: data.featured || false,
      image: data.image || undefined,
      ctaTitle: data.ctaTitle || undefined,
      ctaDescription: data.ctaDescription || undefined,
    };
  });

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string) {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    meta: {
      slug,
      title: data.title || '',
      summary: data.summary || '',
      date: data.date || '',
      category: data.category || '',
      duration: data.duration || '',
      featured: data.featured || false,
      image: data.image || undefined,
      ctaTitle: data.ctaTitle || undefined,
      ctaDescription: data.ctaDescription || undefined,
    },
    content,
  };
}
