import { describe, it, expect } from "bun:test";
import { parseCiiXml } from "@/src/server/parsers/cii";

describe("CII Parser", () => {
  // Sample valid CII XML
  const validCiiXml = {
    CrossIndustryInvoice: {
      ExchangedDocument: {
        ID: "INV-2024-001",
        TypeCode: "380",
        IssueDateTime: {
          DateTimeString: {
            "@_format": "102",
            "#text": "20240115"
          }
        }
      },
      SupplyChainTradeTransaction: {
        ApplicableHeaderTradeAgreement: {
          SellerTradeParty: {
            Name: "Test Seller GmbH",
            PostalTradeAddress: {
              LineOne: "Test Street 123",
              CityName: "Berlin",
              PostcodeCode: "10115",
              CountryID: "DE"
            },
            SpecifiedTaxRegistration: [
              {
                ID: {
                  "@_schemeID": "VA",
                  "#text": "DE123456789"
                }
              }
            ]
          },
          BuyerTradeParty: {
            Name: "Test Buyer AG",
            PostalTradeAddress: {
              LineOne: "Buyer Street 456",
              CityName: "Munich",
              PostcodeCode: "80331",
              CountryID: "DE"
            }
          }
        },
        ApplicableHeaderTradeDelivery: {
          ActualDeliverySupplyChainEvent: {
            OccurrenceDateTime: {
              DateTimeString: {
                "@_format": "102",
                "#text": "20240110"
              }
            }
          }
        },
        ApplicableHeaderTradeSettlement: {
          InvoiceCurrencyCode: "EUR",
          SpecifiedTradeSettlementHeaderMonetarySummation: {
            LineTotalAmount: { "#text": "1000.00", "@_currencyID": "EUR" },
            TaxBasisTotalAmount: { "#text": "1000.00", "@_currencyID": "EUR" },
            TaxTotalAmount: { "#text": "190.00", "@_currencyID": "EUR" },
            GrandTotalAmount: { "#text": "1190.00", "@_currencyID": "EUR" },
            DuePayableAmount: { "#text": "1190.00", "@_currencyID": "EUR" }
          },
          SpecifiedTradePaymentTerms: {
            DueDateDateTime: {
              DateTimeString: {
                "@_format": "102",
                "#text": "20240215"
              }
            }
          },
          SpecifiedTradeSettlementPaymentMeans: {
            PayeePartyCreditorFinancialAccount: {
              IBANID: "DE89370400440532013000"
            },
            PayeeSpecifiedCreditorFinancialInstitution: {
              BICID: "COBADEFFXXX"
            }
          }
        },
        IncludedSupplyChainTradeLineItem: [
          {
            AssociatedDocumentLineDocument: {
              LineID: "1"
            },
            SpecifiedTradeProduct: {
              Name: "Product A"
            },
            SpecifiedLineTradeAgreement: {
              NetPriceProductTradePrice: {
                ChargeAmount: { "#text": "100.00", "@_currencyID": "EUR" }
              }
            },
            SpecifiedLineTradeDelivery: {
              BilledQuantity: {
                "@_unitCode": "C62",
                "#text": "10"
              }
            },
            SpecifiedLineTradeSettlement: {
              ApplicableTradeTax: {
                TypeCode: "VAT",
                CategoryCode: "S",
                RateApplicablePercent: "19"
              },
              SpecifiedTradeSettlementLineMonetarySummation: {
                LineTotalAmount: { "#text": "1000.00", "@_currencyID": "EUR" }
              }
            }
          }
        ]
      }
    }
  };

  describe("parseCiiXml", () => {
    it("should parse document metadata", () => {
      const result = parseCiiXml(validCiiXml);
      
      expect(result.documentNumber).toBe("INV-2024-001");
      expect(result.documentType).toBe("380");
      expect(result.issueDate).toBe("2024-01-15");
    });

    it("should parse seller information", () => {
      const result = parseCiiXml(validCiiXml);
      
      expect(result.seller?.name).toBe("Test Seller GmbH");
      expect(result.seller?.street).toBe("Test Street 123");
      expect(result.seller?.city).toBe("Berlin");
      expect(result.seller?.postalCode).toBe("10115");
      expect(result.seller?.country).toBe("DE");
      expect(result.seller?.vatId).toBe("DE123456789");
    });

    it("should parse buyer information", () => {
      const result = parseCiiXml(validCiiXml);
      
      expect(result.buyer?.name).toBe("Test Buyer AG");
      expect(result.buyer?.street).toBe("Buyer Street 456");
      expect(result.buyer?.city).toBe("Munich");
      expect(result.buyer?.postalCode).toBe("80331");
      expect(result.buyer?.country).toBe("DE");
    });

    it("should parse totals", () => {
      const result = parseCiiXml(validCiiXml);
      
      expect(result.currency).toBe("EUR");
      expect(result.totals?.netAmount).toBe(1000.00);
      expect(result.totals?.taxAmount).toBe(190.00);
      expect(result.totals?.grossAmount).toBe(1190.00);
    });

    it("should parse payment information", () => {
      const result = parseCiiXml(validCiiXml);
      
      expect(result.payment?.iban).toBe("DE89370400440532013000");
      expect(result.payment?.bic).toBe("COBADEFFXXX");
    });

    it("should parse delivery date", () => {
      const result = parseCiiXml(validCiiXml);
      expect(result.deliveryDate).toBe("2024-01-10");
    });

    it("should parse due date", () => {
      const result = parseCiiXml(validCiiXml);
      expect(result.dueDate).toBe("2024-02-15");
    });

    it("should parse line items", () => {
      const result = parseCiiXml(validCiiXml);
      
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
        CrossIndustryInvoice: {
          SupplyChainTradeTransaction: {}
        }
      };
      
      const result = parseCiiXml(minimalXml);
      expect(result.documentNumber).toBeUndefined();
      expect(result.seller).toBeUndefined();
      expect(result.totals).toBeUndefined();
    });

    it("should throw on invalid root element", () => {
      const invalidXml = { InvalidRoot: {} };
      expect(() => parseCiiXml(invalidXml)).toThrow("Invalid CII XML");
    });

    it("should handle single line item (not array)", () => {
      const xmlWithSingleItem = {
        ...validCiiXml,
        CrossIndustryInvoice: {
          ...validCiiXml.CrossIndustryInvoice,
          SupplyChainTradeTransaction: {
            ...validCiiXml.CrossIndustryInvoice.SupplyChainTradeTransaction,
            IncludedSupplyChainTradeLineItem: validCiiXml.CrossIndustryInvoice.SupplyChainTradeTransaction.IncludedSupplyChainTradeLineItem[0]
          }
        }
      };
      
      const result = parseCiiXml(xmlWithSingleItem);
      expect(result.lineItems).toHaveLength(1);
    });

    it("should handle multiple tax registrations", () => {
      const xmlWithMultipleTaxRegs = {
        ...validCiiXml,
        CrossIndustryInvoice: {
          ...validCiiXml.CrossIndustryInvoice,
          SupplyChainTradeTransaction: {
            ...validCiiXml.CrossIndustryInvoice.SupplyChainTradeTransaction,
            ApplicableHeaderTradeAgreement: {
              ...validCiiXml.CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeAgreement,
              SellerTradeParty: {
                ...validCiiXml.CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeAgreement.SellerTradeParty,
                SpecifiedTaxRegistration: [
                  { ID: { "@_schemeID": "VA", "#text": "DE123456789" } },
                  { ID: { "@_schemeID": "FC", "#text": "1234567890" } }
                ]
              }
            }
          }
        }
      };
      
      const result = parseCiiXml(xmlWithMultipleTaxRegs);
      expect(result.seller?.vatId).toBe("DE123456789");
      expect(result.seller?.taxId).toBe("1234567890");
    });
  });
});
