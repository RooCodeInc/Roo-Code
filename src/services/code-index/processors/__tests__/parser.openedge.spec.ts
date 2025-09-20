import { CodeParser } from "../parser"

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

import { shouldUseFallbackChunking } from "../../shared/supported-extensions"

describe("CodeParser - OpenEdge ABL/DF Support", () => {
	let parser: CodeParser

	beforeEach(() => {
		parser = new CodeParser()
	})

	describe("OpenEdge ABL Files", () => {
		it("should use fallback chunking for .p files", async () => {
			// First verify that shouldUseFallbackChunking works
			expect(shouldUseFallbackChunking(".p")).toBe(true)

			const ablContent = `
/* OpenEdge ABL Procedure File */
DEFINE VARIABLE cCustomerName AS CHARACTER NO-UNDO.
DEFINE VARIABLE iOrderCount AS INTEGER NO-UNDO.
DEFINE VARIABLE dTotalAmount AS DECIMAL NO-UNDO.

DEFINE TEMP-TABLE ttOrder
    FIELD OrderID AS INTEGER
    FIELD CustomerID AS INTEGER
    FIELD OrderDate AS DATE
    FIELD TotalAmount AS DECIMAL
    INDEX idxOrder IS PRIMARY OrderID.

PROCEDURE ProcessOrders:
    DEFINE INPUT PARAMETER pcCustomerID AS CHARACTER NO-UNDO.
    DEFINE OUTPUT PARAMETER piOrderCount AS INTEGER NO-UNDO.
    
    FOR EACH Order WHERE Order.CustomerID = pcCustomerID NO-LOCK:
        iOrderCount = iOrderCount + 1.
        dTotalAmount = dTotalAmount + Order.TotalAmount.
        
        CREATE ttOrder.
        ASSIGN
            ttOrder.OrderID = Order.OrderID
            ttOrder.CustomerID = Order.CustomerID
            ttOrder.OrderDate = Order.OrderDate
            ttOrder.TotalAmount = Order.TotalAmount.
    END.
    
    piOrderCount = iOrderCount.
END PROCEDURE.

/* Main Block */
RUN ProcessOrders (INPUT "CUST001", OUTPUT iOrderCount).
DISPLAY "Total Orders: " iOrderCount.
`.trim()

			const result = await parser.parseFile("test.p", {
				content: ablContent,
				fileHash: "test-hash",
			})

			// Should have results from fallback chunking
			expect(result.length).toBeGreaterThan(0)

			// Check that all blocks are of type 'fallback_chunk'
			result.forEach((block) => {
				expect(block.type).toBe("fallback_chunk")
			})

			// Verify content is properly chunked
			const totalContent = result.map((block) => block.content).join("\n")
			expect(totalContent).toBe(ablContent)

			// Verify file path is correct
			expect(result[0].file_path).toBe("test.p")
		})

		it("should use fallback chunking for .i include files", async () => {
			expect(shouldUseFallbackChunking(".i")).toBe(true)

			const includeContent = `
/* OpenEdge ABL Include File */
&SCOPED-DEFINE CUSTOMER-TABLE Customer
&SCOPED-DEFINE ORDER-TABLE Order

DEFINE SHARED VARIABLE gcCompanyName AS CHARACTER NO-UNDO.
DEFINE SHARED VARIABLE gdCurrentDate AS DATE NO-UNDO.

/* Common validation procedure */
PROCEDURE ValidateCustomer:
    DEFINE INPUT PARAMETER pcCustomerID AS CHARACTER NO-UNDO.
    DEFINE OUTPUT PARAMETER plValid AS LOGICAL NO-UNDO.
    
    FIND {&CUSTOMER-TABLE} WHERE {&CUSTOMER-TABLE}.CustomerID = pcCustomerID NO-LOCK NO-ERROR.
    plValid = AVAILABLE({&CUSTOMER-TABLE}).
END PROCEDURE.
`.trim()

			const result = await parser.parseFile("common.i", {
				content: includeContent,
				fileHash: "include-hash",
			})

			expect(result.length).toBeGreaterThan(0)
			result.forEach((block) => {
				expect(block.type).toBe("fallback_chunk")
			})
		})

		it("should use fallback chunking for .w window files", async () => {
			expect(shouldUseFallbackChunking(".w")).toBe(true)

			const windowContent = `
/* OpenEdge ABL Window Definition */
&ANALYZE-SUSPEND _VERSION-NUMBER UIB_v9r12 GUI
&ANALYZE-RESUME

DEFINE VARIABLE cCustomerName AS CHARACTER FORMAT "X(256)":U 
     LABEL "Customer Name" 
     VIEW-AS FILL-IN 
     SIZE 40 BY 1 NO-UNDO.

DEFINE BUTTON btnSearch 
     LABEL "Search" 
     SIZE 15 BY 1.14.

DEFINE FRAME fCustomer
     cCustomerName AT ROW 2 COL 15 COLON-ALIGNED
     btnSearch AT ROW 4 COL 15
     WITH 1 DOWN NO-BOX KEEP-TAB-ORDER OVERLAY 
     SIDE-LABELS NO-UNDERLINE THREE-D 
     AT COL 1 ROW 1
     SIZE 80 BY 16.

ON CHOOSE OF btnSearch IN FRAME fCustomer
DO:
    RUN SearchCustomer.
END.

PROCEDURE SearchCustomer:
    MESSAGE "Searching for customer: " cCustomerName
        VIEW-AS ALERT-BOX INFO BUTTONS OK.
END PROCEDURE.
`.trim()

			const result = await parser.parseFile("customer.w", {
				content: windowContent,
				fileHash: "window-hash",
			})

			expect(result.length).toBeGreaterThan(0)
			result.forEach((block) => {
				expect(block.type).toBe("fallback_chunk")
			})
		})

		it("should use fallback chunking for .cls class files", async () => {
			expect(shouldUseFallbackChunking(".cls")).toBe(true)

			const classContent = `
/* OpenEdge ABL Class File */
USING Progress.Lang.*.

CLASS CustomerManager:
    
    DEFINE PRIVATE VARIABLE cCompanyName AS CHARACTER NO-UNDO.
    DEFINE PRIVATE VARIABLE iCustomerCount AS INTEGER NO-UNDO.
    
    CONSTRUCTOR PUBLIC CustomerManager():
        cCompanyName = "Acme Corp".
        iCustomerCount = 0.
    END CONSTRUCTOR.
    
    METHOD PUBLIC LOGICAL AddCustomer(INPUT pcName AS CHARACTER,
                                      INPUT pcAddress AS CHARACTER):
        DEFINE VARIABLE lSuccess AS LOGICAL NO-UNDO.
        
        CREATE Customer.
        ASSIGN
            Customer.Name = pcName
            Customer.Address = pcAddress
            Customer.DateCreated = TODAY.
        
        iCustomerCount = iCustomerCount + 1.
        lSuccess = TRUE.
        
        RETURN lSuccess.
    END METHOD.
    
    METHOD PUBLIC INTEGER GetCustomerCount():
        RETURN iCustomerCount.
    END METHOD.
    
    DESTRUCTOR PUBLIC CustomerManager():
        /* Cleanup code */
    END DESTRUCTOR.
    
END CLASS.
`.trim()

			const result = await parser.parseFile("CustomerManager.cls", {
				content: classContent,
				fileHash: "class-hash",
			})

			expect(result.length).toBeGreaterThan(0)
			result.forEach((block) => {
				expect(block.type).toBe("fallback_chunk")
			})
		})
	})

	describe("OpenEdge Data Definition Files", () => {
		it("should use fallback chunking for .df files", async () => {
			expect(shouldUseFallbackChunking(".df")).toBe(true)

			const dfContent = `
ADD TABLE "Customer"
  AREA "Customer"
  DESCRIPTION "Customer Master Table"
  DUMP-NAME "customer"

ADD FIELD "CustomerID" OF "Customer" AS integer 
  DESCRIPTION "Unique Customer Identifier"
  FORMAT ">>>>9"
  INITIAL "0"
  LABEL "Customer ID"
  POSITION 2
  MAX-WIDTH 4
  ORDER 10

ADD FIELD "CustomerName" OF "Customer" AS character 
  DESCRIPTION "Customer Name"
  FORMAT "x(50)"
  INITIAL ""
  LABEL "Name"
  POSITION 3
  MAX-WIDTH 100
  ORDER 20

ADD FIELD "Address" OF "Customer" AS character 
  DESCRIPTION "Customer Address"
  FORMAT "x(100)"
  INITIAL ""
  LABEL "Address"
  POSITION 4
  MAX-WIDTH 200
  ORDER 30

ADD FIELD "DateCreated" OF "Customer" AS date 
  DESCRIPTION "Date customer record was created"
  FORMAT "99/99/9999"
  INITIAL ?
  LABEL "Created"
  POSITION 5
  MAX-WIDTH 4
  ORDER 40

ADD INDEX "idxPrimary" ON "Customer" 
  AREA "Customer"
  PRIMARY
  INDEX-FIELD "CustomerID" ASCENDING 

ADD INDEX "idxName" ON "Customer" 
  AREA "Customer"
  INDEX-FIELD "CustomerName" ASCENDING
`.trim()

			const result = await parser.parseFile("customer.df", {
				content: dfContent,
				fileHash: "df-hash",
			})

			// Should have results from fallback chunking
			expect(result.length).toBeGreaterThan(0)

			// Check that all blocks are of type 'fallback_chunk'
			result.forEach((block) => {
				expect(block.type).toBe("fallback_chunk")
			})

			// Verify content is properly chunked
			const totalContent = result.map((block) => block.content).join("\n")
			expect(totalContent).toBe(dfContent)
		})
	})

	describe("Large OpenEdge Files", () => {
		it("should handle large ABL files with proper chunking", async () => {
			// Create a large ABL file content
			const largeAblContent =
				`
/* Large OpenEdge ABL File */
DEFINE VARIABLE i AS INTEGER NO-UNDO.
DEFINE VARIABLE j AS INTEGER NO-UNDO.

` +
				// Generate many procedures to create a large file
				Array.from(
					{ length: 50 },
					(_, idx) => `
PROCEDURE Process${idx}:
    DEFINE INPUT PARAMETER piValue AS INTEGER NO-UNDO.
    DEFINE OUTPUT PARAMETER pcResult AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cTemp AS CHARACTER NO-UNDO.
    DEFINE VARIABLE iCounter AS INTEGER NO-UNDO.
    
    DO iCounter = 1 TO piValue:
        cTemp = cTemp + STRING(iCounter) + ",".
        IF iCounter MOD 10 = 0 THEN DO:
            MESSAGE "Processing batch " iCounter.
        END.
    END.
    
    pcResult = "Processed " + STRING(piValue) + " items: " + cTemp.
    
    /* Additional processing logic */
    FOR EACH Customer NO-LOCK:
        IF Customer.CustomerID = piValue THEN DO:
            pcResult = pcResult + " - Customer: " + Customer.CustomerName.
            LEAVE.
        END.
    END.
END PROCEDURE.
`,
				).join("\n") +
				`
/* Main execution block */
DO i = 1 TO 10:
    RUN Process1 (INPUT i, OUTPUT cResult).
    DISPLAY cResult.
END.
`

			const result = await parser.parseFile("large-test.p", {
				content: largeAblContent,
				fileHash: "large-test-hash",
			})

			// Should have multiple chunks due to size
			expect(result.length).toBeGreaterThan(1)

			// All chunks should be fallback chunks
			result.forEach((block) => {
				expect(block.type).toBe("fallback_chunk")
			})

			// Verify chunks don't exceed max size
			result.forEach((block) => {
				expect(block.content.length).toBeLessThanOrEqual(150000) // MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR
			})
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty OpenEdge files", async () => {
			const emptyContent = ""

			const result = await parser.parseFile("empty.p", {
				content: emptyContent,
				fileHash: "empty-hash",
			})

			// Should return empty array for empty content
			expect(result).toEqual([])
		})

		it("should handle small OpenEdge files below minimum chunk size", async () => {
			const smallContent = "/* Small file */"

			const result = await parser.parseFile("small.cls", {
				content: smallContent,
				fileHash: "small-hash",
			})

			// Should return empty array for content below MIN_BLOCK_CHARS
			expect(result).toEqual([])
		})

		it("should be case-insensitive for OpenEdge extensions", () => {
			// Test uppercase
			expect(shouldUseFallbackChunking(".P")).toBe(true)
			expect(shouldUseFallbackChunking(".I")).toBe(true)
			expect(shouldUseFallbackChunking(".W")).toBe(true)
			expect(shouldUseFallbackChunking(".CLS")).toBe(true)
			expect(shouldUseFallbackChunking(".DF")).toBe(true)

			// Test mixed case
			expect(shouldUseFallbackChunking(".Cls")).toBe(true)
			expect(shouldUseFallbackChunking(".Df")).toBe(true)
		})
	})
})

describe("Fallback Extensions Configuration with OpenEdge", () => {
	it("should correctly identify all OpenEdge extensions as needing fallback chunking", () => {
		// OpenEdge ABL extensions
		expect(shouldUseFallbackChunking(".p")).toBe(true)
		expect(shouldUseFallbackChunking(".i")).toBe(true)
		expect(shouldUseFallbackChunking(".w")).toBe(true)
		expect(shouldUseFallbackChunking(".cls")).toBe(true)
		expect(shouldUseFallbackChunking(".df")).toBe(true)

		// Previously configured fallback extensions should still work
		expect(shouldUseFallbackChunking(".vb")).toBe(true)
		expect(shouldUseFallbackChunking(".scala")).toBe(true)
		expect(shouldUseFallbackChunking(".swift")).toBe(true)

		// Extensions with working parsers should not use fallback
		expect(shouldUseFallbackChunking(".js")).toBe(false)
		expect(shouldUseFallbackChunking(".ts")).toBe(false)
		expect(shouldUseFallbackChunking(".py")).toBe(false)
	})
})
