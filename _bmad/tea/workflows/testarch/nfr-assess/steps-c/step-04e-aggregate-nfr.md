---
name: "step-04e-aggregate-nfr"
description: "Aggregate NFR domain assessments into executive summary"
nextStepFile: "./step-05-generate-report.md"
---

# Step 4E: Aggregate NFR Assessment Results

## STEP GOAL

Read outputs from 4 parallel NFR subprocesses, calculate overall risk level, aggregate compliance status, and identify cross-domain risks.

---

## MANDATORY EXECUTION RULES

- 📖 Read the entire step file before acting
- ✅ Speak in `{communication_language}`
- ✅ Read all 4 subprocess outputs
- ✅ Calculate overall risk level
- ❌ Do NOT re-assess NFRs (use subprocess outputs)

---

## MANDATORY SEQUENCE

### 1. Read All Subprocess Outputs

```javascript
const domains = ["security", "performance", "reliability", "scalability"]
const assessments = {}

domains.forEach((domain) => {
	const outputPath = `/tmp/tea-nfr-${domain}-{{timestamp}}.json`
	assessments[domain] = JSON.parse(fs.readFileSync(outputPath, "utf8"))
})
```

---

### 2. Calculate Overall Risk Level

**Risk hierarchy:** HIGH > MEDIUM > LOW > NONE

```javascript
const riskLevels = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }
const domainRisks = domains.map((d) => assessments[d].risk_level)
const maxRiskValue = Math.max(...domainRisks.map((r) => riskLevels[r]))
const overallRisk = Object.keys(riskLevels).find((k) => riskLevels[k] === maxRiskValue)
```

**Risk assessment:**

- If ANY domain is HIGH → overall is HIGH
- If ANY domain is MEDIUM (and none HIGH) → overall is MEDIUM
- If ALL domains are LOW/NONE → overall is LOW

---

### 3. Aggregate Compliance Status

```javascript
const allCompliance = {}

domains.forEach((domain) => {
	const compliance = assessments[domain].compliance
	Object.entries(compliance).forEach(([standard, status]) => {
		if (!allCompliance[standard]) {
			allCompliance[standard] = []
		}
		allCompliance[standard].push({ domain, status })
	})
})

// Determine overall compliance per standard
const complianceSummary = {}
Object.entries(allCompliance).forEach(([standard, statuses]) => {
	const hasFail = statuses.some((s) => s.status === "FAIL")
	const hasPartial = statuses.some((s) => s.status === "PARTIAL" || s.status === "CONCERN")

	complianceSummary[standard] = hasFail ? "FAIL" : hasPartial ? "PARTIAL" : "PASS"
})
```

---

### 4. Identify Cross-Domain Risks

**Look for risks that span multiple domains:**

```javascript
const crossDomainRisks = []

// Example: Performance + Scalability issue
const perfConcerns = assessments.performance.findings.filter((f) => f.status !== "PASS")
const scaleConcerns = assessments.scalability.findings.filter((f) => f.status !== "PASS")
if (perfConcerns.length > 0 && scaleConcerns.length > 0) {
	crossDomainRisks.push({
		domains: ["performance", "scalability"],
		description: "Performance issues may worsen under scale",
		impact: "HIGH",
	})
}

// Example: Security + Reliability issue
const securityFails = assessments.security.findings.filter((f) => f.status === "FAIL")
const reliabilityConcerns = assessments.reliability.findings.filter((f) => f.status !== "PASS")
if (securityFails.length > 0 && reliabilityConcerns.length > 0) {
	crossDomainRisks.push({
		domains: ["security", "reliability"],
		description: "Security vulnerabilities may cause reliability incidents",
		impact: "CRITICAL",
	})
}
```

---

### 5. Aggregate Priority Actions

```javascript
const allPriorityActions = domains.flatMap((domain) =>
	assessments[domain].priority_actions.map((action) => ({
		domain,
		action,
		urgency: assessments[domain].risk_level === "HIGH" ? "URGENT" : "NORMAL",
	})),
)

// Sort by urgency
const prioritizedActions = allPriorityActions.sort((a, b) => (a.urgency === "URGENT" ? -1 : 1))
```

---

### 6. Generate Executive Summary

```javascript
const executiveSummary = {
	overall_risk: overallRisk,
	assessment_date: new Date().toISOString(),

	domain_assessments: assessments,

	compliance_summary: complianceSummary,

	cross_domain_risks: crossDomainRisks,

	priority_actions: prioritizedActions,

	risk_breakdown: {
		security: assessments.security.risk_level,
		performance: assessments.performance.risk_level,
		reliability: assessments.reliability.risk_level,
		scalability: assessments.scalability.risk_level,
	},

	subprocess_execution: "PARALLEL (4 NFR domains)",
	performance_gain: "~67% faster than sequential",
}

// Save for Step 5 (report generation)
fs.writeFileSync("/tmp/tea-nfr-summary-{{timestamp}}.json", JSON.stringify(executiveSummary, null, 2), "utf8")
```

---

### 7. Display Summary to User

```
✅ NFR Assessment Complete (Parallel Execution)

🎯 Overall Risk Level: {overallRisk}

📊 Domain Risk Breakdown:
- Security:      {security_risk}
- Performance:   {performance_risk}
- Reliability:   {reliability_risk}
- Scalability:   {scalability_risk}

✅ Compliance Summary:
{list standards with PASS/PARTIAL/FAIL}

⚠️ Cross-Domain Risks: {cross_domain_risk_count}

🎯 Priority Actions: {priority_action_count}

🚀 Performance: Parallel execution ~67% faster

✅ Ready for report generation (Step 5)
```

---

## EXIT CONDITION

Proceed to Step 5 when:

- ✅ All subprocess outputs read
- ✅ Overall risk calculated
- ✅ Compliance aggregated
- ✅ Summary saved

Load next step: `{nextStepFile}`

---

## 🚨 SYSTEM SUCCESS METRICS

### ✅ SUCCESS:

- All 4 NFR domains aggregated correctly
- Overall risk level determined
- Executive summary complete

### ❌ FAILURE:

- Failed to read subprocess outputs
- Risk calculation incorrect
