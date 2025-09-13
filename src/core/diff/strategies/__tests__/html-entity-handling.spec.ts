import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("HTML entity handling", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy()
	})

	it("should distinguish between HTML entities and their literal characters", async () => {
		const originalContent = `.FilterBatch&lt;int&gt;(batch =&gt; batch.Count == 3)
.MapBatch&lt;int, int&gt;(batch =&gt; batch.Sum())`

		const diffContent = `
<<<<<<< SEARCH
.FilterBatch&lt;int&gt;(batch =&gt; batch.Count == 3)
=======
.FilterBatch<int>(batch => batch.Count == 3)
>>>>>>> REPLACE

<<<<<<< SEARCH
.MapBatch&lt;int, int&gt;(batch =&gt; batch.Sum())
=======
.MapBatch<int, int>(batch => batch.Sum())
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`.FilterBatch<int>(batch => batch.Count == 3)
.MapBatch<int, int>(batch => batch.Sum())`)
		}
	})

	it("should not treat &lt; and < as identical in search/replace comparison", async () => {
		const originalContent = `public List&lt;string&gt; GetItems() {
    return new List&lt;string&gt;();
}`

		const diffContent = `
<<<<<<< SEARCH
public List&lt;string&gt; GetItems() {
    return new List&lt;string&gt;();
}
=======
public List<string> GetItems() {
    return new List<string>();
}
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`public List<string> GetItems() {
    return new List<string>();
}`)
		}
	})

	it("should handle mixed HTML entities correctly", async () => {
		const originalContent = `&lt;div class=&quot;container&quot;&gt;
    &lt;p&gt;Hello &amp; welcome&lt;/p&gt;
&lt;/div&gt;`

		const diffContent = `
<<<<<<< SEARCH
&lt;div class=&quot;container&quot;&gt;
    &lt;p&gt;Hello &amp; welcome&lt;/p&gt;
&lt;/div&gt;
=======
<div class="container">
    <p>Hello & welcome</p>
</div>
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`<div class="container">
    <p>Hello & welcome</p>
</div>`)
		}
	})

	it("should reject when search and replace are identical (including HTML entities)", async () => {
		const originalContent = `function test<T>() {
    return value;
}`

		// Both search and replace have the same content (literal angle brackets)
		const diffContent = `
<<<<<<< SEARCH
function test<T>() {
    return value;
}
=======
function test<T>() {
    return value;
}
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(false)
		if (!result.success && result.error) {
			expect(result.error).toContain("Search and replace content are identical")
		}
	})

	it("should handle apostrophes and quotes with HTML entities", async () => {
		const originalContent = `const message = &apos;It&apos;s a &quot;test&quot; message&apos;;`

		const diffContent = `
<<<<<<< SEARCH
const message = &apos;It&apos;s a &quot;test&quot; message&apos;;
=======
const message = 'It\'s a "test" message';
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`const message = 'It\'s a "test" message';`)
		}
	})

	it("should handle C# generics with escaped HTML entities", async () => {
		const originalContent = `var dict = new Dictionary&lt;string, List&lt;int&gt;&gt;();
dict.Add(&quot;key&quot;, new List&lt;int&gt; { 1, 2, 3 });`

		const diffContent = `
<<<<<<< SEARCH
var dict = new Dictionary&lt;string, List&lt;int&gt;&gt;();
dict.Add(&quot;key&quot;, new List&lt;int&gt; { 1, 2, 3 });
=======
var dict = new Dictionary<string, List<int>>();
dict.Add("key", new List<int> { 1, 2, 3 });
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`var dict = new Dictionary<string, List<int>>();
dict.Add("key", new List<int> { 1, 2, 3 });`)
		}
	})

	it("should handle the exact issue from bug report", async () => {
		const originalContent = `                    .FilterBatch&lt;int&gt;(batch =&gt; batch.Count == 3)
                    .MapBatch&lt;int, int&gt;(batch =&gt; batch.Sum())`

		// This is the exact diff that was failing before the fix
		const diffContent = `
<<<<<<< SEARCH
                    .FilterBatch&lt;int&gt;(batch =&gt; batch.Count == 3)
=======
                    .FilterBatch<int>(batch => batch.Count == 3)
>>>>>>> REPLACE

<<<<<<< SEARCH
                    .MapBatch&lt;int, int&gt;(batch =&gt; batch.Sum())
=======
                    .MapBatch<int, int>(batch => batch.Sum())
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe(`                    .FilterBatch<int>(batch => batch.Count == 3)
                    .MapBatch<int, int>(batch => batch.Sum())`)
		}
	})
})
