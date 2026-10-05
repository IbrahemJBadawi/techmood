/**
 * LinkedIn, the two ways it lets a site hand something over.
 *
 *   * A certificate goes straight into the member's «Licenses & Certifications»
 *     through LinkedIn's Add-to-Profile link — name, issuer, date, number and
 *     the public verification page, filled in for them.
 *   * Anything else (a project, an assignment) has no such link: LinkedIn
 *     offers no way to add to the Projects section from outside. It becomes a
 *     post instead, with its text written and its link inside.
 *
 * NEXT_PUBLIC_LINKEDIN_ORG_ID, when TechMood's company page id is set, makes
 * the certificate show the company's logo; without it the issuer is the name.
 */

const ORG_ID = process.env.NEXT_PUBLIC_LINKEDIN_ORG_ID?.trim();

export function linkedInCertificateUrl(input: {
  name: string;
  code: string;
  issuedAt: string;
  verifyUrl: string;
}): string {
  const issued = new Date(input.issuedAt);
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: input.name,
    ...(ORG_ID ? { organizationId: ORG_ID } : { organizationName: 'TechMood' }),
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: input.verifyUrl,
    certId: input.code,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/** LinkedIn's composer, opened with the post already written. */
export function linkedInPostUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}
