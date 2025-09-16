// Test script to debug the stripLineNumbers issue
const { stripLineNumbers, everyLineHasLineNumbers } = require("./src/integrations/misc/extract-text")

// Test case from the issue
const searchContent = `1473 |                                                 ContactRelaEnum.MS.name(), addressList, contactStatusMap, SensitiveType.ADDRESS, curSector);
1474 |                         }
1475 |                 }
1476 |                 List<ContactInfoItemResp> addressInfoList = new ArrayList<>(CollectionUtils.size(repairInfoList) > 10 ? 10
1477 |                                 : CollectionUtils.size(repairInfoList) + CollectionUtils.size(homeAddressInfoList)
1478 |                                                 + CollectionUtils.size(idNoAddressInfoList) + CollectionUtils.size(workAddressInfoList)
1479 |                                                 + CollectionUtils.size(personIdentityInfoList));`

const replaceContent = `1473 |                                                 ContactRelaEnum.MS.name(), addressList, contactStatusMap, SensitiveType.ADDRESS, curSector);
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
1488 |                                                 + CollectionUtils.size(personIdentityInfoList));`

console.log("Testing everyLineHasLineNumbers:")
console.log("Search content has line numbers:", everyLineHasLineNumbers(searchContent))
console.log("Replace content has line numbers:", everyLineHasLineNumbers(replaceContent))

console.log("\nTesting stripLineNumbers:")
const strippedSearch = stripLineNumbers(searchContent)
const strippedReplace = stripLineNumbers(replaceContent)

console.log("\nOriginal search last line:")
console.log(JSON.stringify(searchContent.split("\n").slice(-1)[0]))

console.log("\nStripped search last line:")
console.log(JSON.stringify(strippedSearch.split("\n").slice(-1)[0]))

console.log("\nOriginal replace last line:")
console.log(JSON.stringify(replaceContent.split("\n").slice(-1)[0]))

console.log("\nStripped replace last line:")
console.log(JSON.stringify(strippedReplace.split("\n").slice(-1)[0]))

// Test with content that doesn't end with newline
const testWithoutNewline =
	"1479 |                                                 + CollectionUtils.size(personIdentityInfoList));"
console.log("\nTest without trailing newline:")
console.log("Has line numbers:", everyLineHasLineNumbers(testWithoutNewline))
console.log("Stripped:", JSON.stringify(stripLineNumbers(testWithoutNewline)))
