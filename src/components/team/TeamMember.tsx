import Image from 'next/image';
import { Button } from '@brikdesigns/bds';
import { Icon } from '@/lib/icon';
import { text, heading, label } from '@/lib/styles';
import { color, font } from '@/lib/tokens';
import type { TeamMember as TeamMemberData } from '@/lib/team';

/**
 * Shared team-member card. One component, two orientations — a variant, not a
 * fork (#1274):
 *
 *  • `horizontal` — the /about bio card: a bare circular headshot beside the
 *    name, role, social links, and the full multi-paragraph bio. Unchanged from
 *    the pre-extraction `.about-team-member` markup.
 *  • `stacked` — the home `about` section card: a circular headshot inset in a
 *    tinted rounded panel, then name, role, and the one-line `summary`. No
 *    social links, no full bio.
 *
 * Layout + tints live in `.team-member*` (shared-sections.css). The stacked
 * panel tint is keyed off `data-accent` (member.accent).
 */
export function TeamMember({
  member,
  orientation,
}: {
  member: TeamMemberData;
  orientation: 'horizontal' | 'stacked';
}) {
  const stacked = orientation === 'stacked';
  // A section heading on /about (the cards ARE the team section's headings); a
  // sub-heading on home (nested under the section's own SectionHeader h2).
  const Title = stacked ? 'h3' : 'h2';
  const dim = stacked ? 188 : 304;

  return (
    <article
      className={`team-member team-member--${orientation}`}
      data-accent={stacked ? member.accent : undefined}
    >
      {stacked ? (
        <div className="team-member__panel">
          <div className="team-member__avatar">
            <Image
              src={member.image}
              alt={member.fullName}
              width={dim}
              height={dim}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        </div>
      ) : (
        <div className="team-member__avatar">
          <Image
            src={member.image}
            alt={member.fullName}
            width={dim}
            height={dim}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>
      )}

      <div className="team-member__body">
        <div className="team-member__head">
          <Title style={stacked ? heading.md : heading.lg}>
            {stacked ? member.name : `Meet ${member.name}`}
          </Title>
          <p style={{ ...label.smBold, color: color.text.secondary }}>{member.role}</p>
        </div>

        {stacked ? (
          <p style={{ ...text.bodyLg, fontSize: font.size.body.xl }}>{member.summary}</p>
        ) : (
          <>
            <div className="team-member__social">
              <Button
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="sm"
                icon={<Icon icon="ph:linkedin-logo" />}
                label={`${member.name} on LinkedIn`}
              />
              <Button
                href={`mailto:${member.email}`}
                variant="secondary"
                size="sm"
                icon={<Icon icon="ph:envelope-simple" />}
                label={`Email ${member.name}`}
              />
              {member.website && (
                <Button
                  href={member.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon="ph:globe" />}
                  label={`${member.name}'s website`}
                />
              )}
            </div>
            <div className="team-member__bio">
              {member.bio.map((paragraph, i) => (
                <p key={i} style={{ ...text.body, color: color.text.secondary }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
