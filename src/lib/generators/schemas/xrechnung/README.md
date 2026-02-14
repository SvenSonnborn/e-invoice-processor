These XSD files are used for offline CII/EN16931 schema validation in the
XRechnung generator.

Source:

- Factur-X EN16931 schema set (currently bundled as `Factur-X_1.07.3_*` files,
  as distributed in `node-zugferd`)

Runtime behavior:

- The generator automatically picks the highest bundled
  `Factur-X_*_EN16931.xsd` file as default.
- A custom schema can still be provided via generator option `xsdPath`.
