const localeTag = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/

// The header is user-controlled and serialized into the page: keep only a well-formed language tag.
export function parsePreferredLocale(acceptLanguage?: string, fallback = 'en'): string {
    const firstTag = acceptLanguage?.slice(0, 200).split(',')[0]?.split(';')[0]?.trim()

    return firstTag && localeTag.test(firstTag) ? firstTag : fallback
}
