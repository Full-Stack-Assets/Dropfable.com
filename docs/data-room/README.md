# Diligence data room (private)

Keep the live room **out of git**. This folder is the checklist and empty templates. Copy it to a private drive when a buyer is under NDA.

## Required artifacts

- [ ] Entity docs and cap table (founder 100% is fine if documented)
- [ ] IP assignment from contractors and coding agents
- [ ] Domain, Firebase, GCP, GitHub, Stripe, GA4 in the company name
- [ ] Terms, privacy, AI-output license ([public/terms.html](../../public/terms.html), [public/privacy.html](../../public/privacy.html))
- [ ] Architecture one-pager: Pages SPA + Express API + Gemini; optional OpenAI fallback; no customer API keys in git
- [ ] Unit economics: model $ per manufacture, gross margin, refunds
- [ ] Cohort: paying users, generations, kits downloaded, listings marked, sales noted
- [ ] Known-risks memo: Gemini lock-in, Etsy AI enforcement, content originality, autonomous job disabled
- [ ] Three reference sellers

Fill [unit-economics.template.csv](./unit-economics.template.csv) and [cohort.template.csv](./cohort.template.csv) monthly. Do not commit real customer PII here.
