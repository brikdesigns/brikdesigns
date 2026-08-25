# CSV vs DB Gap Audit

**last-verified:** 2026-08-25

Generated: 2026-05-24. Source of truth: Webflow CSV exports in `content/csv/`; DB schema from `src/types/supabase.ts` (project `lmhzpzobdkstzpvsqest`).

**Legend:** ✓ = column present in DB with matching semantics | ~ = partial match (different shape, single vs many, or split across columns) | ✗ = no DB home

---

## Services.csv → `services`

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Description, Tagline, Related, Primary Badge, Secondary Badge, Image, Service Line, Offerings, E-Commerce Products [IGNORE], Not Included in support plan, Support Plan, Rank, Is featured service, Has customer story, Has multiple offerings, Has maintenance add-on`

| CSV column | DB state | Note |
|---|---|---|
| Name | ✓ | `services.name` |
| Slug | ✓ | `services.slug` |
| Collection ID | ✗ | Webflow CMS metadata; no DB column |
| Locale ID | ✗ | Webflow CMS metadata; no DB column |
| Item ID | ✗ | Webflow CMS metadata; no DB column |
| Archived | ~ | Approximated by `services.active` (bool) — no explicit archived flag |
| Draft | ~ | No `draft` column; `is_public` is closest gating field |
| Created On | ✓ | `services.created_at` |
| Updated On | ✓ | `services.updated_at` |
| Published On | ✗ | No `published_at` on `services` |
| Description | ✓ | `services.description` |
| Tagline | ✓ | `services.tagline` |
| Related | ~ | `services.related_service_slug` (single text slug); CSV holds many related refs — only one is persisted |
| Primary Badge | ~ | Mapped to `services.image_url` or no explicit badge column; see `service_lines` for badge imagery |
| Secondary Badge | ✗ | No secondary badge column on `services` |
| Image | ✓ | `services.image_url` |
| Service Line | ✓ | `services.service_line_id` (FK to `service_lines`) |
| Offerings | ✓ | Represented by child rows in `offerings` table via `offerings.service_id` FK |
| E-Commerce Products [IGNORE] | ✗ | Marked IGNORE in CSV; no DB column needed |
| Not Included in support plan | ✗ | No such column on `services`; `offerings.not_included` exists but scoped to offerings |
| Support Plan | ✓ | `services.support_plan_slug` |
| Rank | ✓ | `services.rank` |
| Is featured service | ✗ | No `is_featured` on `services` (exists on `offerings` but not `services`) |
| Has customer story | ✓ | `services.has_customer_story` |
| Has multiple offerings | ✗ | No `has_multiple_offerings` on `services` (exists on `offerings`) |
| Has maintenance add-on | ✗ | No `has_maintenance_add_on` on `services` (exists on `offerings`) |

---

## Service Lines.csv → `service_lines`

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Tagline, Description, Hero, Main Image, Primary Badge - light, Secondary Badge, Services, Support Plan, Support Plan Img, Light, Base, Dark, Rank`

| CSV column | DB state | Note |
|---|---|---|
| Name | ✓ | `service_lines.name` |
| Slug | ✓ | `service_lines.slug` |
| Collection ID | ✗ | Webflow CMS metadata |
| Locale ID | ✗ | Webflow CMS metadata |
| Item ID | ✗ | Webflow CMS metadata |
| Archived | ~ | No explicit archived flag; `is_public` gates visibility |
| Draft | ~ | No `draft` column; `is_public` is closest proxy |
| Created On | ✓ | `service_lines.created_at` |
| Updated On | ✓ | `service_lines.updated_at` |
| Published On | ✗ | No `published_at` on `service_lines` |
| Tagline | ✓ | `service_lines.tagline` |
| Description | ✓ | `service_lines.description` |
| Hero | ✓ | `service_lines.hero_image_url` |
| Main Image | ✓ | `service_lines.card_image_url` |
| Primary Badge - light | ✗ | No badge image URL column; the legacy `brand_color_*` hex columns were retired (#934) — service-line colour now derives from `slug` via the BDS ServiceTag |
| Secondary Badge | ✗ | No secondary badge image URL on `service_lines` |
| Services | ✓ | Represented by child rows in `services` table via `services.service_line_id` FK |
| Support Plan | ✓ | `service_lines.support_plan_slug` |
| Support Plan Img | ✓ | `service_lines.support_plan_image_url` |
| Light | ✗ | `brand_color_light` retired (#934); colour derives from `slug` via the BDS ServiceTag |
| Base | ✗ | `brand_color_base` retired (#934); colour derives from `slug` via the BDS ServiceTag |
| Dark | ✗ | `brand_color_dark` retired (#934); colour derives from `slug` via the BDS ServiceTag |
| Rank | ✓ | `service_lines.rank` |

---

## Offerings.csv → `offerings`

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Icon, Price Model, Service, Service Line, Related Service, Price, Description, What You Get, Standalone Service, Tier Options, Tier Rank, Multi-Tier Offerings, Offering Tab Group`

| CSV column | DB state | Note |
|---|---|---|
| Name | ✓ | `offerings.name` |
| Slug | ✓ | `offerings.slug` |
| Collection ID | ✗ | Webflow CMS metadata |
| Locale ID | ✗ | Webflow CMS metadata |
| Item ID | ✗ | Webflow CMS metadata |
| Archived | ~ | `offerings.active` (bool inverse) — no explicit archived flag |
| Draft | ~ | `offerings.is_public` is closest proxy; no `draft` column |
| Created On | ✓ | `offerings.created_at` |
| Updated On | ✓ | `offerings.updated_at` |
| Published On | ✗ | No `published_at` on `offerings` |
| Icon | ✗ | No `icon_url` on primary `offerings`; exists as `icon_url` on `offerings_legacy` only |
| Price Model | ~ | `offerings_legacy.price_model` (legacy table only); not present on primary `offerings` |
| Service | ✓ | `offerings.service_id` (FK to `services`) |
| Service Line | ✓ | `offerings.service_line_id` (FK to `service_lines`) |
| Related Service | ✓ | `offerings.related_service_slug` |
| Price | ~ | `offerings.base_price_cents` (integer cents); CSV stores display string |
| Description | ✓ | `offerings.description` |
| What You Get | ~ | `offerings.included_scope` is the closest field; legacy table has `what_you_get` explicitly |
| Standalone Service | ~ | `offerings_legacy.is_standalone` (bool); not present on primary `offerings` table |
| Tier Options | ~ | `offerings_legacy.has_tier_options` (bool); not on primary `offerings` |
| Tier Rank | ~ | `offerings_legacy.tier_rank`; not on primary `offerings` — gap in current table |
| Multi-Tier Offerings | ~ | `offerings.has_multiple_offerings` covers this intent |
| Offering Tab Group | ✗ | No tab group column on `offerings` or `offerings_legacy` |

---

## Blog Posts.csv → `blog_posts`

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Post Summary, Date Published, Main Image, Featured?, Service, Color, Category, Section 1, Section 2, Section 3, CTA Title, CTA Description, Duration, Date Icon, Duration Icon, Animation`

| CSV column | DB state | Note |
|---|---|---|
| Name | ✓ | `blog_posts.title` |
| Slug | ✓ | `blog_posts.slug` |
| Collection ID | ✗ | Webflow CMS metadata |
| Locale ID | ✗ | Webflow CMS metadata |
| Item ID | ✗ | Webflow CMS metadata |
| Archived | ~ | No archived flag; `status` field is closest proxy |
| Draft | ~ | `blog_posts.status` (e.g. `draft`) — partial; no dedicated bool |
| Created On | ✓ | `blog_posts.created_at` |
| Updated On | ✓ | `blog_posts.updated_at` |
| Published On | ✓ | `blog_posts.published_at` |
| Post Summary | ✓ | `blog_posts.excerpt` |
| Date Published | ✓ | `blog_posts.published_at` (same as Published On) |
| Main Image | ✓ | `blog_posts.featured_image_url` |
| Featured? | ✓ | `blog_posts.featured` (bool) |
| Service | ✓ | `blog_posts.primary_service_id` (FK to `services`) |
| Color | ✗ | No color field on `blog_posts` |
| Category | ~ | `blog_posts.primary_category_id` (FK to `service_lines`, not a dedicated category table); `tags` array also present |
| Section 1 | ~ | No separate section columns; all body content flattened into single `blog_posts.content` field |
| Section 2 | ~ | See Section 1 — collapsed into `content` |
| Section 3 | ~ | See Section 1 — collapsed into `content` |
| CTA Title | ✓ | `blog_posts.cta_title` |
| CTA Description | ✓ | `blog_posts.cta_description` |
| Duration | ✓ | `blog_posts.duration` |
| Date Icon | ✗ | No icon URL fields on `blog_posts` |
| Duration Icon | ✗ | No duration icon URL on `blog_posts` |
| Animation | ✗ | No animation field on `blog_posts` |

---

## Customer Stories.csv → `customer_stories`

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Client, Short Description, Hero Image, Hero Video, Industry Badge, Industry, Thumbnail, Client Logo, Client Icon, Launch Date, Date Icon, URL, URL Icon, Client Website, The Challenge, The Solution, Results, Quote, Customer Name, Before Photo, After Photo, Results Photo, Service, Service Line, Service Line Icon, Service Lines, Services, Service Icon, Rank, Before Video, After Video, Results Video, Custom Code`

| CSV column | DB state | Note |
|---|---|---|
| Name | ✓ | `customer_stories.name` |
| Slug | ✓ | `customer_stories.slug` |
| Collection ID | ✗ | Webflow CMS metadata |
| Locale ID | ✗ | Webflow CMS metadata |
| Item ID | ✗ | Webflow CMS metadata |
| Archived | ~ | No archived flag; `is_public` gates visibility |
| Draft | ~ | `is_public` is closest proxy; no dedicated draft column |
| Created On | ✓ | `customer_stories.created_at` |
| Updated On | ✓ | `customer_stories.updated_at` |
| Published On | ✗ | No `published_at` on `customer_stories` |
| Client | ✓ | `customer_stories.client_name` |
| Short Description | ✓ | `customer_stories.short_description` |
| Hero Image | ✓ | `customer_stories.hero_image_url` |
| Hero Video | ✓ | `customer_stories.hero_video_url` |
| Industry Badge | ✗ | No `industry_badge_url` column on `customer_stories` |
| Industry | ✓ | `customer_stories.industry` (text) + `industry_slug` |
| Thumbnail | ✓ | `customer_stories.thumbnail_url` |
| Client Logo | ✓ | `customer_stories.client_logo_url` |
| Client Icon | ✗ | No `client_icon_url` column on `customer_stories` |
| Launch Date | ✓ | `customer_stories.launch_date` |
| Date Icon | ✗ | No date icon URL on `customer_stories` |
| URL | ✓ | `customer_stories.website_url` |
| URL Icon | ✗ | No URL icon field on `customer_stories` |
| Client Website | ✓ | `customer_stories.client_website` + `client_website_display` |
| The Challenge | ✓ | `customer_stories.the_challenge` |
| The Solution | ✓ | `customer_stories.the_solution` |
| Results | ✓ | `customer_stories.results` |
| Quote | ✓ | `customer_stories.quote` |
| Customer Name | ✓ | `customer_stories.quote_attribution` |
| Before Photo | ✓ | `customer_stories.before_photo_url` |
| After Photo | ✓ | `customer_stories.after_photo_url` |
| Results Photo | ✓ | `customer_stories.results_photo_url` |
| Service | ~ | `customer_stories.service_slug` (single text); CSV primary service — partial coverage |
| Service Line | ✓ | `customer_stories.service_line_slug` |
| Service Line Icon | ✗ | No `service_line_icon_url` column on `customer_stories` |
| Service Lines | ✗ | No multi-service-line array; only single `service_line_slug` — CSV self-reference for multiple lines not modelled |
| Services | ~ | `customer_story_services` junction table covers many services; singular `service_slug` column creates duplication risk |
| Service Icon | ✗ | No service icon URL on `customer_stories` |
| Rank | ✓ | `customer_stories.rank` |
| Before Video | ✓ | `customer_stories.before_video_url` |
| After Video | ✓ | `customer_stories.after_video_url` |
| Results Video | ✓ | `customer_stories.results_video_url` |
| Custom Code | ✗ | No custom code / embed field on `customer_stories` |

---

## Customers.csv → `industry_pages` (+ `industry_page_topics`)

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Tagline, Intro Title, Intro Description, Clients, Web Templates, Primary Badge, Secondary Badge, Image, Topic 1 Title, Topic 1 Description, Topic 1 Service Line, Topic 1 Services, Topic 1 Image, Topic 2 Title, Topic 2 Description, Topic 2 Service Line, Topic 2 Services, Topic 2 Image, Topic 3 Title, Topic 3 Description, Topic 3 Service Line, Topic 3 Services, Topic 3 Image, Topic 4 Title, Topic 4 Description, Topic 4 Service Line, Topic 4 Services, Topic 4 Image`

| CSV column | DB state | Note |
|---|---|---|
| Name | ✓ | `industry_pages.name` |
| Slug | ✓ | `industry_pages.slug` |
| Collection ID | ✗ | Webflow CMS metadata |
| Locale ID | ✗ | Webflow CMS metadata |
| Item ID | ✗ | Webflow CMS metadata |
| Archived | ~ | No archived flag; `is_public` gates visibility |
| Draft | ~ | `is_public` is closest proxy; no dedicated draft column |
| Created On | ✓ | `industry_pages.created_at` |
| Updated On | ✓ | `industry_pages.updated_at` |
| Published On | ✗ | No `published_at` on `industry_pages` |
| Tagline | ✓ | `industry_pages.tagline` |
| Intro Title | ✓ | `industry_pages.intro_title` |
| Intro Description | ✓ | `industry_pages.intro_description` |
| Clients | ✗ | No "clients" reference column on `industry_pages`; Webflow linked to customer story items — not modelled in DB |
| Web Templates | ✗ | No templates reference on `industry_pages`; no templates table exists in DB |
| Primary Badge | ✓ | `industry_pages.primary_badge_url` |
| Secondary Badge | ✓ | `industry_pages.secondary_badge_url` |
| Image | ✓ | `industry_pages.image_url` |
| Topic 1 Title | ✓ | `industry_page_topics.title` where `topic_number = 1` |
| Topic 1 Description | ✓ | `industry_page_topics.description` where `topic_number = 1` |
| Topic 1 Service Line | ✓ | `industry_page_topics.service_line_slug` where `topic_number = 1` |
| Topic 1 Services | ✓ | `industry_page_topic_services` junction rows for topic 1 |
| Topic 1 Image | ✓ | `industry_page_topics.image_url` where `topic_number = 1` |
| Topic 2 Title | ✓ | `industry_page_topics.title` where `topic_number = 2` |
| Topic 2 Description | ✓ | `industry_page_topics.description` where `topic_number = 2` |
| Topic 2 Service Line | ✓ | `industry_page_topics.service_line_slug` where `topic_number = 2` |
| Topic 2 Services | ✓ | `industry_page_topic_services` junction rows for topic 2 |
| Topic 2 Image | ✓ | `industry_page_topics.image_url` where `topic_number = 2` |
| Topic 3 Title | ✓ | `industry_page_topics.title` where `topic_number = 3` |
| Topic 3 Description | ✓ | `industry_page_topics.description` where `topic_number = 3` |
| Topic 3 Service Line | ✓ | `industry_page_topics.service_line_slug` where `topic_number = 3` |
| Topic 3 Services | ✓ | `industry_page_topic_services` junction rows for topic 3 |
| Topic 3 Image | ✓ | `industry_page_topics.image_url` where `topic_number = 3` |
| Topic 4 Title | ✓ | `industry_page_topics.title` where `topic_number = 4` |
| Topic 4 Description | ✓ | `industry_page_topics.description` where `topic_number = 4` |
| Topic 4 Service Line | ✓ | `industry_page_topics.service_line_slug` where `topic_number = 4` |
| Topic 4 Services | ✓ | `industry_page_topic_services` junction rows for topic 4 |
| Topic 4 Image | ✓ | `industry_page_topics.image_url` where `topic_number = 4` |

---

## Templates.csv → *(no table)*

CSV headers: `Name, Slug, Collection ID, Locale ID, Item ID, Archived, Draft, Created On, Updated On, Published On, Thumbnail, Full Image, Description, Industry, Theme, Type, Color, Tone, Demo Site, Icon, Style, Primary, Secondary, Accent, Neutral, Brand`

No corresponding table exists in the DB schema. All columns are ✗.

| CSV column | DB state | Note |
|---|---|---|
| Name | ✗ | No table |
| Slug | ✗ | No table |
| Collection ID | ✗ | No table |
| Locale ID | ✗ | No table |
| Item ID | ✗ | No table |
| Archived | ✗ | No table |
| Draft | ✗ | No table |
| Created On | ✗ | No table |
| Updated On | ✗ | No table |
| Published On | ✗ | No table |
| Thumbnail | ✗ | No table |
| Full Image | ✗ | No table |
| Description | ✗ | No table |
| Industry | ✗ | No table |
| Theme | ✗ | No table |
| Type | ✗ | No table |
| Color | ✗ | No table |
| Tone | ✗ | No table |
| Demo Site | ✗ | No table |
| Icon | ✗ | No table |
| Style | ✗ | No table |
| Primary | ✗ | No table — likely a brand color primitive |
| Secondary | ✗ | No table — likely a brand color primitive |
| Accent | ✗ | No table — likely a brand color primitive |
| Neutral | ✗ | No table — likely a brand color primitive |
| Brand | ✗ | No table — likely a brand color primitive |

---

## Gap summary

| Surface | Key gaps |
|---|---|
| `services` | `is_featured`, `has_multiple_offerings`, `has_maintenance_add_on` exist on `offerings` not `services`; secondary badge URL; `not_included in support plan`; `published_at` missing |
| `service_lines` | Secondary badge image URL missing; `Light`/`Base`/`Dark` hex columns retired (#934, colour from `slug`); `published_at` missing |
| `offerings` | Icon URL dropped from primary table (in `offerings_legacy` only); `price_model`, `is_standalone`, `has_tier_options`, `tier_rank` all legacy-only; `Offering Tab Group` unmapped |
| `blog_posts` | `Service`→`primary_service_id` FK and `Category`→`primary_category_id` FK (→ `service_lines`) now modelled; no `color`; Sections 1–3 collapsed into single `content`; date/duration icons and animation field missing |
| `customer_stories` | Multi-`service_lines` array not modelled (only single `service_line_slug`); `industry_badge`, `client_icon`, `service_line_icon`, `service_icon`, `date_icon`, `url_icon`, `custom_code` missing; `published_at` missing |
| `industry_pages` | `Clients` reference (→ customer stories) not modelled; `Web Templates` reference not modelled |
| `templates` | Entire collection has no DB table — full schema needed before this surface can be built |
