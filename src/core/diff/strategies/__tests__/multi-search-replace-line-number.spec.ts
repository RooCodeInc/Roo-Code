import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("MultiSearchReplaceDiffStrategy - Line Number Stripping", () => {
	describe("line number stripping at last line", () => {
		let strategy: MultiSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiSearchReplaceDiffStrategy()
		})

		it("should correctly strip line numbers from the last line in SEARCH and REPLACE blocks", async () => {
			// This test case reproduces the issue from GitHub issue #8020
			// where the last line with a line number wasn't being stripped correctly
			// Note: The original content should NOT have line numbers
			const originalContent = `                                                ContactRelaEnum.MS.name(), addressList, contactStatusMap, SensitiveType.ADDRESS, curSector);
			                     }
			             }
			             List<ContactInfoItemResp> addressInfoList = new ArrayList<>(CollectionUtils.size(repairInfoList) > 10 ? 10
			                             : CollectionUtils.size(repairInfoList) + CollectionUtils.size(homeAddressInfoList)
			                                             + CollectionUtils.size(idNoAddressInfoList) + CollectionUtils.size(workAddressInfoList)
			                                             + CollectionUtils.size(personIdentityInfoList));`

			const diffContent = `<<<<<<< SEARCH
1473 |                                                 ContactRelaEnum.MS.name(), addressList, contactStatusMap, SensitiveType.ADDRESS, curSector);
1474 |                         }
1475 |                 }
1476 |                 List<ContactInfoItemResp> addressInfoList = new ArrayList<>(CollectionUtils.size(repairInfoList) > 10 ? 10
1477 |                                 : CollectionUtils.size(repairInfoList) + CollectionUtils.size(homeAddressInfoList)
1478 |                                                 + CollectionUtils.size(idNoAddressInfoList) + CollectionUtils.size(workAddressInfoList)
1479 |                                                 + CollectionUtils.size(personIdentityInfoList));
=======
1473 |                                                 ContactRelaEnum.MS.name(), addressList, contactStatusMap, SensitiveType.ADDRESS, curSector);
1474 |                         }
1475 |                 }
1476 |                 
1477 |                 // 
1478 |                 if (isAddressDisplayOptimizeEnabled()) {
1479 |                     homeAddressInfoList = filterAddressesByThreeYearRule(homeAddressInfoList);
1480 |                     personIdentityInfoList = filterAddressesByThreeYearRule(personIdentityInfoList);
1481 |                     idNoAddressInfoList = filterAddressesByThreeYearRule(idNoAddressInfoList);
1482 |                     workAddressInfoList = filterAddressesByThreeYearRule(workAddressInfoList);
1483 |                 }
1484 |                 
1485 |                 List<ContactInfoItemResp> addressInfoList = new ArrayList<>(CollectionUtils.size(repairInfoList) > 10 ? 10
1486 |                                 : CollectionUtils.size(repairInfoList) + CollectionUtils.size(homeAddressInfoList)
1487 |                                                 + CollectionUtils.size(idNoAddressInfoList) + CollectionUtils.size(workAddressInfoList)
1488 |                                                 + CollectionUtils.size(personIdentityInfoList));
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			if (!result.success) {
				console.error("Test failed with error:", result.error || result.failParts)
			}
			expect(result.success).toBe(true)
			if (result.success) {
				const expectedContent = `                                                ContactRelaEnum.MS.name(), addressList, contactStatusMap, SensitiveType.ADDRESS, curSector);
                        }
                }
                
                // 
                if (isAddressDisplayOptimizeEnabled()) {
                    homeAddressInfoList = filterAddressesByThreeYearRule(homeAddressInfoList);
                    personIdentityInfoList = filterAddressesByThreeYearRule(personIdentityInfoList);
                    idNoAddressInfoList = filterAddressesByThreeYearRule(idNoAddressInfoList);
                    workAddressInfoList = filterAddressesByThreeYearRule(workAddressInfoList);
                }
                
                List<ContactInfoItemResp> addressInfoList = new ArrayList<>(CollectionUtils.size(repairInfoList) > 10 ? 10
                                : CollectionUtils.size(repairInfoList) + CollectionUtils.size(homeAddressInfoList)
                                                + CollectionUtils.size(idNoAddressInfoList) + CollectionUtils.size(workAddressInfoList)
                                                + CollectionUtils.size(personIdentityInfoList));`
				expect(result.content).toBe(expectedContent)
			}
		})

		it("should handle Windows CRLF line endings with line numbers at the last line", async () => {
			// Test with Windows-style CRLF line endings
			const originalContent = "line 1\r\nline 2\r\nline 3"
			const diffContent = `<<<<<<< SEARCH
1 | line 1
2 | line 2
3 | line 3
=======
1 | line 1
2 | modified line 2
3 | line 3
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe("line 1\r\nmodified line 2\r\nline 3")
			}
		})

		it("should handle single line with line number at the end", async () => {
			// Simple test case for a single line with line number
			const originalContent = "some content here"
			const diffContent = `<<<<<<< SEARCH
1 | some content here
=======
1 | modified content here
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe("modified content here")
			}
		})
	})
})
