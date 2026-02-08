const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');

/**
 * Get published blog posts for sitemap
 * Note: This runs at build time, so recently-scheduled posts may lag
 */
function getPublishedBlogPosts() {
  const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
  
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  const posts = [];
  
  // Get current time in PT for publish check
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type)?.value ?? '';
  const nowDate = `${get('year')}-${get('month')}-${get('day')}`;
  const nowMinutes = parseInt(get('hour')) * 60 + parseInt(get('minute'));
  
  for (const file of files) {
    const filepath = path.join(BLOG_DIR, file);
    const raw = fs.readFileSync(filepath, 'utf8');
    const { data } = matter(raw);
    
    // Check if post is published
    if (data.status !== 'published') continue;
    
    // Parse publish time
    const timeMatch = data.publish_time_pt?.match(/^(1[0-2]|[1-9]):([0-5][0-9])(am|pm)$/i);
    if (!timeMatch) continue;
    
    let hours = parseInt(timeMatch[1]);
    const mins = parseInt(timeMatch[2]);
    const isPm = timeMatch[3].toLowerCase() === 'pm';
    if (hours === 12) hours = isPm ? 12 : 0;
    else if (isPm) hours += 12;
    const postMinutes = hours * 60 + mins;
    
    // Check if post is past publish date/time
    const isPublished = nowDate > data.publish_date || 
      (nowDate === data.publish_date && nowMinutes >= postMinutes);
    
    if (isPublished && data.slug) {
      posts.push(data.slug);
    }
  }
  
  return posts;
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://roocode.com',
  generateRobotsTxt: true,
  generateIndexSitemap: false, // We don't need index sitemap for a small site
  changefreq: 'monthly',
  priority: 0.7,
  sitemapSize: 5000,
  exclude: [
    '/api/*',
    '/server-sitemap-index.xml',
    '/404',
    '/500',
    '/_not-found',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    additionalSitemaps: [
      // Add any additional sitemaps here if needed in the future
    ],
  },
  // Custom transform function to set specific priorities and change frequencies
  transform: async (config, path) => {
    // Set custom priority for specific pages
    let priority = config.priority;
    let changefreq = config.changefreq;
    
    if (path === '/') {
      priority = 1.0;
      changefreq = 'yearly';
    } else if (path === '/enterprise' || path === '/evals') {
      priority = 0.8;
      changefreq = 'monthly';
    } else if (path === '/privacy' || path === '/terms') {
      priority = 0.5;
      changefreq = 'yearly';
    } else if (path === '/blog') {
      priority = 0.8;
      changefreq = 'weekly';
    } else if (path.startsWith('/blog/')) {
      priority = 0.7;
      changefreq = 'monthly';
    }
    
    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      alternateRefs: config.alternateRefs ?? [],
    };
  },
  additionalPaths: async (config) => {
    const result = [];
    
    // Add the /evals page since it's a dynamic route
    result.push({
      loc: '/evals',
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    });
    
    // Add /blog index
    result.push({
      loc: '/blog',
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    });
    
    // Add published blog posts
    try {
      const slugs = getPublishedBlogPosts();
      for (const slug of slugs) {
        result.push({
          loc: `/blog/${slug}`,
          changefreq: 'monthly',
          priority: 0.7,
          lastmod: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Could not load blog posts for sitemap:', e.message);
    }
    
    return result;
  },
};
