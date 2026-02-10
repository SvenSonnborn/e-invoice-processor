# Test Fixtures

## ZUGFeRD PDF (`zugferd-invoice.pdf`)

The integration test `tests/integration/zugferd-parser.test.ts` can run a full end-to-end parse of a real ZUGFeRD PDF when this fixture is present.

**To enable the test:** Place a ZUGFeRD 2.x or XRechnung sample PDF at:

```
tests/fixtures/zugferd-invoice.pdf
```

**Sample sources:**

- [ZUGFeRD/corpus](https://github.com/ZUGFeRD/corpus) – sample and test invoices (ZUGFeRDv2, XML-Rechnung, etc.)
- [KoSIT XRechnung](https://www.xoev.de/) – official XRechnung samples

If the file is missing, the test is skipped and a short note is printed. The fixture is not committed to the repo to avoid large binaries.
