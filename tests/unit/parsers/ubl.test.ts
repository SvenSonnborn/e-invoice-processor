import { describe, it, expect } from "bun:test";
import { parseUblXml } from "@/src/server/parsers/ubl";

describe("UBL Parser", () => {
  // Sample valid UBL XML structure (parsed)
  const validUblXml = {
    Invoice: {
      ID: "INV-2024-001",
      IssueDate: "2024-01-15",
      DueDate: "2024-02-15",
      InvoiceTypeCode: "380",
      DocumentCurrencyCode: "EUR",
      
      AccountingSupplierParty: {
        Party: {
          PartyName: {
            Name: "Test Seller GmbH"
          },
          PostalAddress: {
            StreetName: "Test Street 123",
            CityName: "Berlin",
            PostalZone: "10115",
            Country: {
              IdentificationCode: "DE"
            }
          },
          PartyTaxScheme: {
            CompanyID: "DE123456789",
            TaxScheme: {
              ID: "VAT"
            }
          },
          PartyLegalEntity: {
            RegistrationName: "Test Seller GmbH"
          }
        }
      },
      
      AccountingCustomerParty: {
        Party: {
          PartyName: {
            Name: "Test Buyer AG"
          },
          PostalAddress: {
            StreetName: "Buyer Street 456",
            CityName: "Munich",
            PostalZone: "80331",
            Country: {
              IdentificationCode: "DE"
            }
          }
        }
      },
      
      Delivery: {
        ActualDeliveryDate: "2024-01-10"
      },
      
      LegalMonetaryTotal: {
        LineExtensionAmount: { "#text": "1000.00", "@_currencyID": "EUR" },
        TaxExclusiveAmount: { "#text": "1000.00", "@_currencyID": "EUR" },
        TaxInclusiveAmount: { "#text": "1190.00", "@_currencyID": "EUR" },
        PayableAmount: { "#text": "1190.00", "@_currencyID": "EUR" }
      },
      
      PaymentMeans: {
        PaymentID: "Payment within 30 days",
        PayeeFinancialAccount: {
          ID: "DE89370400440532013000",
          FinancialInstitutionBranch: {
            FinancialInstitution: {
              ID: "COBADEFFXXX"
            }
          }
        }
      },
      
      InvoiceLine: [
        {
          ID: "1",
          InvoicedQuantity: { "@_unitCode": "C62", "#text": "10" },
          LineExtensionAmount: { "#text": "1000.00", "@_currencyID": "EUR" },
          Item: {
            Name: "Product A",
            Description: "Description of Product A",
            ClassifiedTaxCategory: {
              Percent: "19"
            }
          },
          Price: {
            PriceAmount: { "#text": "100.00", "@_currencyID": "EUR" }
          }
        }
      ]
    }
  };

  describe("parseUblXml", () => {
    it("should parse document metadata", () => {
      const result = parseUblXml(validUblXml);
      
      expect(result.documentNumber).toBe("INV-2024-001");
      expect(result.issueDate).toBe("2024-01-15");
      expect(result.dueDate).toBe("2024-02-15");
      expect(result.documentType).toBe("380");
      expect(result.currency).toBe("EUR");
    });

    it("should parse seller information", () => {
      const result = parseUblXml(validUblXml);
      
      expect(result.seller?.name).toBe("Test Seller GmbH");
      expect(result.seller?.street).toBe("Test Street 123");
      expect(result.seller?.city).toBe("Berlin");
      expect(result.seller?.postalCode).toBe("10115");
      expect(result.seller?.country).toBe("DE");
      expect(result.seller?.vatId).toBe("DE123456789");
    });

    it("should parse buyer information", () => {
      const result = parseUblXml(validUblXml);
      
      expect(result.buyer?.name).toBe("Test Buyer AG");
      expect(result.buyer?.street).toBe("Buyer Street 456");
      expect(result.buyer?.city).toBe("Munich");
      expect(result.buyer?.postalCode).toBe("80331");
      expect(result.buyer?.country).toBe("DE");
    });

    it("should parse totals", () => {
      const result = parseUblXml(validUblXml);
      
      expect(result.totals?.netAmount).toBe(1000.00);
      expect(result.totals?.grossAmount).toBe(1190.00);
      expect(result.totals?.taxAmount).toBe(190.00);
    });

    it("should parse payment information", () => {
      const result = parseUblXml(validUblXml);
      
      expect(result.payment?.terms).toBe("Payment within 30 days");
      expect(result.payment?.iban).toBe("DE89370400440532013000");
      expect(result.payment?.bic).toBe("COBADEFFXXX");
    });

    it("should parse delivery date", () => {
      const result = parseUblXml(validUblXml);
      expect(result.deliveryDate).toBe("2024-01-10");
    });

    it("should parse line items", () => {
      const result = parseUblXml(validUblXml);
      
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems?.[0].id).toBe("1");
      expect(result.lineItems?.[0].description).toBe("Product A");
      expect(result.lineItems?.[0].quantity).toBe(10);
      expect(result.lineItems?.[0].unit).toBe("C62");
      expect(result.lineItems?.[0].unitPrice).toBe(100.00);
      expect(result.lineItems?.[0].lineTotal).toBe(1000.00);
      expect(result.lineItems?.[0].vatRate).toBe(19);
    });

    it("should handle missing optional fields", () => {
      const minimalXml = {
        Invoice: {
          ID: "INV-001",
          IssueDate: "2024-01-15",
          InvoiceTypeCode: "380",
          DocumentCurrencyCode: "EUR",
          AccountingSupplierParty: {
            Party: {}
          },
          AccountingCustomerParty: {
            Party: {}
          },
          LegalMonetaryTotal: {
            PayableAmount: { "#text": "100.00", "@_currencyID": "EUR" }
          }
        }
      };
      
      const result = parseUblXml(minimalXml);
      expect(result.documentNumber).toBe("INV-001");
      expect(result.seller?.name).toBeUndefined();
    });

    it("should throw on invalid root element", () => {
      const invalidXml = { InvalidRoot: {} };
      expect(() => parseUblXml(invalidXml)).toThrow("Invalid UBL XML");
    });

    it("should handle single line item (not array)", () => {
      const xmlWithSingleItem = {
        Invoice: {
          ...validUblXml.Invoice,
          InvoiceLine: validUblXml.Invoice.InvoiceLine[0]
        }
      };
      
      const result = parseUblXml(xmlWithSingleItem);
      expect(result.lineItems).toHaveLength(1);
    });

    it("should handle multiple tax schemes", () => {
      const xmlWithMultipleTaxSchemes = {
        Invoice: {
          ...validUblXml.Invoice,
          AccountingSupplierParty: {
            Party: {
              ...validUblXml.Invoice.AccountingSupplierParty.Party,
              PartyTaxScheme: [
                { CompanyID: "DE123456789", TaxScheme: { ID: "VAT" } },
                { CompanyID: "1234567890", TaxScheme: { ID: "TAX" } }
              ]
            }
          }
        }
      };
      
      const result = parseUblXml(xmlWithMultipleTaxSchemes);
      expect(result.seller?.vatId).toBe("DE123456789");
    });

    it("should extract seller name from PartyLegalEntity if PartyName not present", () => {
      const xmlWithoutPartyName = {
        Invoice: {
          ...validUblXml.Invoice,
          AccountingSupplierParty: {
            Party: {
              ...validUblXml.Invoice.AccountingSupplierParty.Party,
              PartyName: undefined
            }
          }
        }
      };
      
      const result = parseUblXml(xmlWithoutPartyName);
      expect(result.seller?.name).toBe("Test Seller GmbH");
    });

    it("should parse payment instruction note", () => {
      const xmlWithNote = {
        Invoice: {
          ...validUblXml.Invoice,
          PaymentMeans: {
            InstructionNote: "Pay within 14 days for 2% discount"
          }
        }
      };
      
      const result = parseUblXml(xmlWithNote);
      expect(result.payment?.terms).toBe("Pay within 14 days for 2% discount");
    });

    it("should calculate tax amount from totals", () => {
      const xmlWithTotals = {
        Invoice: {
          ...validUblXml.Invoice,
          LegalMonetaryTotal: {
            TaxExclusiveAmount: { "#text": "500.00", "@_currencyID": "EUR" },
            TaxInclusiveAmount: { "#text": "595.00", "@_currencyID": "EUR" },
            PayableAmount: { "#text": "595.00", "@_currencyID": "EUR" }
          }
        }
      };
      
      const result = parseUblXml(xmlWithTotals);
      expect(result.totals?.netAmount).toBe(500.00);
      expect(result.totals?.grossAmount).toBe(595.00);
      expect(result.totals?.taxAmount).toBe(95.00);
    });
  });
});
