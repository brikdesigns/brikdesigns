'use client';

import Image from 'next/image';
import { Icon } from '@iconify/react';
import { Card, CardDescription, CardFooter, ServiceTag } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { heading, label, text } from '@/lib/styles';
import { color } from '@/lib/tokens';

const INDUSTRY_ICONS: Record<string, string> = {
  'Small Business': 'ph:storefront',
  'Dental': 'ph:tooth',
  'Real Estate': 'ph:house',
};

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

interface MetaItemProps {
  fieldLabel: string;
  icon: React.ReactNode;
  value: string;
}

function MetaItem({ fieldLabel, icon, value }: MetaItemProps) {
  return (
    <div className="story-meta__item">
      <span style={{ ...label.smBold, color: color.text.primary }}>{fieldLabel}</span>
      <span className="story-meta__value" style={{ ...text.bodySm, color: color.text.secondary }}>
        <span className="story-meta__icon">{icon}</span>
        {value}
      </span>
    </div>
  );
}

export interface CustomerStoryCardProps {
  slug: string;
  name: string;
  clientName: string;
  industry: string | null;
  launchDate: string | null;
  serviceLineName: string | null;
  serviceLineCategory: ServiceCategory | null;
  serviceName: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  iconServiceName?: string;
}

export function CustomerStoryCard({
  slug, name, clientName, industry, launchDate,
  serviceLineName, serviceLineCategory, serviceName,
  shortDescription, imageUrl, iconServiceName,
}: CustomerStoryCardProps) {
  const formattedDate = formatDate(launchDate);
  const industryIcon = industry ? (INDUSTRY_ICONS[industry] ?? 'ph:buildings') : null;

  return (
    <Card variant="outlined" interactive href={`/customer-stories/${slug}`} className="story-card">
      <div className="story-card__row">
        {imageUrl && (
          <div className="story-card__image-wrap">
            <div className="story-card__image">
              <Image
                src={imageUrl}
                alt={clientName || name}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 767px) 100vw, 340px"
              />
            </div>
          </div>
        )}
        <div className="story-card__content">
          <h3 style={heading.md}>{name}</h3>

          <div className="story-card__meta">
            {clientName && (
              <MetaItem
                fieldLabel="Client"
                icon={<Icon icon="ph:buildings" width={16} height={16} />}
                value={clientName}
              />
            )}
            {formattedDate && (
              <MetaItem
                fieldLabel="Date Released"
                icon={<Icon icon="ph:calendar-blank" width={16} height={16} />}
                value={formattedDate}
              />
            )}
            {industry && industryIcon && (
              <MetaItem
                fieldLabel="Industry"
                icon={<Icon icon={industryIcon} width={16} height={16} />}
                value={industry}
              />
            )}
            {serviceLineCategory && serviceLineName && (
              <MetaItem
                fieldLabel="Service Line"
                icon={<ServiceTag category={serviceLineCategory} variant="icon" size="sm" />}
                value={serviceLineName}
              />
            )}
            {serviceLineCategory && serviceName && (
              <MetaItem
                fieldLabel="Service"
                icon={
                  <ServiceTag
                    category={serviceLineCategory}
                    variant="icon"
                    size="sm"
                    {...(iconServiceName ? { serviceName: iconServiceName } : {})}
                  />
                }
                value={serviceName}
              />
            )}
          </div>

          {shortDescription && (
            <CardDescription style={{ ...text.bodySmall, marginTop: 0 }}>
              {shortDescription}
            </CardDescription>
          )}

          <CardFooter>
            <span className={composeButtonClasses({ variant: 'primary', size: 'md' })}>
              Read Story
            </span>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}
