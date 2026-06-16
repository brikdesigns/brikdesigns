// Fixture for lint-heading-case.test.mjs — NOT shipped, NOT scanned by the real
// gate (it globs src/**, not scripts/**). Exercises every branch of the rule.
/* eslint-disable */
export function Sample({ cmsTitle }: { cmsTitle: string }) {
  return (
    <>
      {/* violations */}
      <h2>What we do</h2>
      <h3>Monthly subscription</h3>

      {/* clean — minor word lowercase mid-string, hyphen both caps, pronoun */}
      <h2>Our Services</h2>
      <h2>Get in Touch</h2>
      <h2>The Value of Design</h2>
      <h2>Industries We Know Inside-Out</h2>
      <Section title="What We Do With It" />

      {/* exempt — conversational / status copy ends in . ! ? */}
      <Section title="Message sent!" />
      <Section title="Thanks! We'll be in touch." />
      <h2>Not sure what you need yet?</h2>

      {/* skipped — CMS interpolation */}
      <h2>{cmsTitle}</h2>

      {/* ignored — inline escape hatch */}
      <h2>iOS and beyond</h2> {/* lint-heading-case-ignore */}
    </>
  );
}
