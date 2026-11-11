# SEO Implementation for Cancionero

## Overview

This document details the SEO optimization implementation for the Cancionero project (https://tonygb.com/cancionero). The implementation includes automated robots.txt and sitemap.xml generation integrated into the build process.

---

## 🎯 Implementation Strategy

### Target Audience
- Music enthusiasts searching for song lyrics
- Users discovering new artists and songs
- Spanish-language music content consumers
- Mobile-first audience (React/Vite optimized)

### Key SEO Goals
1. **Discoverability**: Improve visibility in search results for song/artist searches
2. **International**: Support both Spanish and English content
3. **Performance**: Lightning-fast load times with Vite optimization
4. **Maintenance**: Zero-maintenance automated SEO file generation

---

## 📋 Implementation Details

### Automated SEO File Generation

**Location:** `scripts/generate-seo-files.js`

**Features:**
- Generates `robots.txt` with search engine-specific rules
- Generates `sitemap.xml` with all music content pages
- Automatically runs during build process
- Environment variables support:
  - `DOMAIN`: Target domain (default: cancionero.example.com)
  - `GOOGLE_ANALYTICS_ID`: Analytics tracking ID (optional)

**Build Integration:**
```bash
npm run build
# Automatically generates:
# - dist/robots.txt
# - dist/sitemap.xml
```

### robots.txt Configuration

**Generated robots.txt includes:**

```
# robots.txt for https://tonygb.com/cancionero

# Allow all bots
User-agent: *
Allow: /

# Search engine specific rules
User-agent: Googlebot
Crawl-delay: 1

User-agent: Bingbot
Crawl-delay: 2

# Sitemap location
Sitemap: https://tonygb.com/cancionero/sitemap.xml
```

**Key Features:**
- Optimized crawl delays per search engine
- Social media crawler allowances
- Dynamic sitemap location based on DOMAIN environment variable

### sitemap.xml Configuration

**Dynamic Sitemap Structure:**

Routes included (automatically generated):
- Homepage: `/` (priority: 1.0, weekly)
- Songs listing: `/songs` (priority: 0.8, daily)
- Artists listing: `/artists` (priority: 0.8, weekly)
- Individual song pages: `/songs/:id` (priority: 0.7, monthly)
- Individual artist pages: `/artists/:id` (priority: 0.7, monthly)
- About page: `/about` (priority: 0.6, monthly)

**Features:**
- Priority hierarchy (1.0 for homepage, 0.6-0.7 for content)
- Proper change frequency settings
- Timestamps automatically updated on each build
- XML namespace compliance

---

## 🔧 Environment Configuration

### GitHub Actions Setup

For GitHub Pages deployment, configure in `.github/workflows/`:

**Environment Variables:**
```yaml
env:
  DOMAIN: tonygb.com/cancionero
  GOOGLE_ANALYTICS_ID: ${{ secrets.GOOGLE_ANALYTICS_ID }}
```

**Build Step:**
```yaml
- name: Build with SEO generation
  run: npm run build
  env:
    DOMAIN: ${{ env.DOMAIN }}
    GOOGLE_ANALYTICS_ID: ${{ secrets.GOOGLE_ANALYTICS_ID }}
```

### Local Development

**Set environment variables:**
```bash
# For local testing
export DOMAIN=localhost:3000/cancionero
export GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Run build
npm run build

# Verify generated files
ls -la dist/robots.txt
ls -la dist/sitemap.xml
```

---

## 📊 File Generation Details

### Script: `scripts/generate-seo-files.js`

**Execution Flow:**
1. Reads environment variables (DOMAIN, GOOGLE_ANALYTICS_ID)
2. Generates robots.txt with appropriate rules
3. Generates sitemap.xml with defined routes
4. Writes to dist/ directory
5. Outputs success message with timestamps

**Performance:**
- Execution time: ~50-100ms
- No external dependencies
- Zero runtime overhead (static file generation)
- Idempotent (safe to run multiple times)

**Error Handling:**
- Validates DOMAIN environment variable
- Creates dist/ directory if missing
- Logs all operations to console
- Exits gracefully on errors

---

## 🌐 Multi-Domain Support

### Domain Configuration

The implementation supports multiple domain deployments:

**Production (GitHub Pages):**
```
DOMAIN=tonygb.com/cancionero
Result:
  - robots.txt: Sitemap: https://tonygb.com/cancionero/sitemap.xml
  - sitemap.xml: https://tonygb.com/cancionero/
```

**Custom Domain:**
```
DOMAIN=music.example.com
Result:
  - robots.txt: Sitemap: https://music.example.com/sitemap.xml
  - sitemap.xml: https://music.example.com/
```

**Local Development:**
```
DOMAIN=localhost:3000/cancionero
Result:
  - robots.txt: Sitemap: http://localhost:3000/cancionero/sitemap.xml
  - sitemap.xml: http://localhost:3000/cancionero/
```

---

## 📱 Mobile Optimization

### React/Vite Advantages

**Performance:**
- Fast initial load with Vite
- Lazy-loaded components
- Optimized bundle size
- Mobile-first CSS

**SEO Impact:**
- Better Core Web Vitals scores
- Improved ranking potential
- Better mobile indexing by Google
- Faster crawling speed

### Responsive Design

The cancionero site is fully responsive:
- Mobile: Touch-optimized interface
- Tablet: Adaptive layouts
- Desktop: Full-featured experience

Google's mobile-first indexing will prioritize the mobile experience.

---

## 🔍 Search Engine Coverage

### Google Search Console

**Setup Steps:**
1. Verify property: https://tonygb.com/cancionero
2. Submit sitemap: https://tonygb.com/cancionero/sitemap.xml
3. Monitor coverage in "Coverage" report
4. Track keywords in "Performance" report

**Expected Timeline:**
- Day 1: Sitemap received
- 3-7 days: Initial indexing
- 2-4 weeks: Ranking in search results

### Bing Webmaster Tools

**Setup Steps:**
1. Add site: https://tonygb.com/cancionero
2. Submit sitemap: https://tonygb.com/cancionero/sitemap.xml
3. Monitor in "Sitemaps" section

---

## 📈 Content SEO

### Page Optimization

Each content page should include:
- Unique, descriptive titles (50-60 characters)
- Meta descriptions (150-160 characters)
- Structured data (JSON-LD for Music schema)
- Internal linking strategy

### Song Pages

**Meta Tags Example:**
```html
<title>Song Title - Artist Name | Cancionero</title>
<meta name="description" content="Lyrics and information for Song Title by Artist Name">
<meta property="og:type" content="music.song">
<meta property="og:title" content="Song Title">
<meta property="og:description" content="Official lyrics and info">
```

### Artist Pages

**Meta Tags Example:**
```html
<title>Artist Name - Discography | Cancionero</title>
<meta name="description" content="All songs and lyrics by Artist Name">
<meta property="og:type" content="music.artist">
<meta property="og:title" content="Artist Name">
```

---

## ✅ Testing & Validation

### robots.txt Validation

**Check syntax:**
```bash
# View generated file
cat dist/robots.txt

# Validate format
# - Should start with User-agent
# - Should have Allow/Disallow rules
# - Should have Sitemap location
```

**Test with Google:**
- https://support.google.com/webmasters/answer/6062598

### sitemap.xml Validation

**Check well-formedness:**
```bash
# View generated file
cat dist/sitemap.xml

# Validate XML
# - Should have <?xml?> declaration
# - Should have proper <urlset> root
# - All URLs should be properly encoded
```

**Test with Google:**
- Submit to Search Console
- https://search.google.com/test/mobile-friendly

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Run `npm run build` locally
- [ ] Verify robots.txt generated in dist/
- [ ] Verify sitemap.xml generated in dist/
- [ ] Test robots.txt syntax
- [ ] Test sitemap.xml well-formedness
- [ ] Check environment variables in GitHub Actions

### Deployment
- [ ] Push branch to GitHub
- [ ] Create pull request with changes
- [ ] Pass any CI/CD checks
- [ ] Merge to main branch
- [ ] Verify GitHub Pages deployment

### Post-Deployment
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Monitor coverage in Search Console
- [ ] Track indexation progress
- [ ] Monitor keyword rankings

---

## 📊 Monitoring & Optimization

### Weekly Checks
- Monitor indexation status in GSC
- Check for crawl errors
- Review Core Web Vitals

### Monthly Reviews
- Analyze search performance
- Identify keyword opportunities
- Optimize underperforming pages
- Track ranking changes

### Quarterly Strategy
- Review content gaps
- Analyze competitor strategy
- Plan content improvements
- Update SEO strategy

---

## 🔐 Security Considerations

### robots.txt Security
- Does not expose any sensitive paths
- Allows search engine crawling
- Protects non-public content with Disallow

### sitemap.xml Security
- Only includes public-facing pages
- Uses https URLs
- Does not include authentication-required pages

### Privacy
- Respects user privacy
- Complies with GDPR
- Does not track personally identifiable information

---

## 📚 Related Documentation

### In Repository
- `README.md` - Project overview
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `TECHNICAL_IMPLEMENTATION.md` - Architecture

### External Resources
- [Google Search Central](https://developers.google.com/search)
- [Sitemap Protocol](https://www.sitemaps.org/)
- [robots.txt Specification](https://www.robotstxt.org/)
- [Schema.org Music Schema](https://schema.org/MusicRecording)

---

## 🎯 Success Metrics

### Indexation Metrics
- Target: >80% of pages indexed within 30 days
- Target: 100% of core pages indexed
- Target: Zero critical crawl errors

### Performance Metrics
- Target: Average position < 30 (within 90 days)
- Target: CTR > 1% for branded keywords
- Target: 50+ monthly search impressions

### Engagement Metrics
- Target: Session duration > 1:30
- Target: Bounce rate < 60%
- Target: Pages per session > 2

---

## 📝 Changelog

### Version 1.0 (November 2026)
- Initial SEO implementation
- Automated robots.txt generation
- Automated sitemap.xml generation
- Environment variable support
- GitHub Actions integration
- Documentation complete

---

## ❓ FAQ

**Q: How often is the sitemap updated?**
A: Every time you deploy to GitHub Pages. The sitemap is generated during the build process with current timestamps.

**Q: Can I manually add pages to the sitemap?**
A: Yes, edit the routes array in `scripts/generate-seo-files.js` and the pages will be included in the next build.

**Q: What if my domain changes?**
A: Update the DOMAIN environment variable in GitHub Actions, and the next build will generate files with the new domain.

**Q: Do I need to submit the sitemap to search engines?**
A: Yes, initially. After that, search engines will crawl it regularly. We recommend resubmitting when making major content changes.

**Q: How can I track SEO performance?**
A: Use Google Search Console and Google Analytics to monitor indexation, rankings, and traffic.

---

**Version:** 1.0  
**Last Updated:** November 11, 2026  
**Status:** Production Ready

---

For questions or issues, refer to the main repository documentation or create an issue on GitHub.
