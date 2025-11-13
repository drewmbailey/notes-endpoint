import { validateCategory } from "./utils/validation.js";

console.log("Testing nested category validation...\n");

// Test cases
const testCases = [
  // Valid cases
  { category: "Personal", expected: true },
  { category: "Commonplace Books/Coding/General/Design Patterns", expected: true },
  { category: "Personal/Health/Blood Pressure", expected: true },
  { category: "Work/UNH Developer Project/Interview Prep", expected: true },
  { category: "Test_Category-123", expected: true },
  
  // Invalid cases
  { category: "", expected: false, reason: "empty" },
  { category: "/Personal", expected: false, reason: "leading slash" },
  { category: "Personal/", expected: false, reason: "trailing slash" },
  { category: "Personal//Health", expected: false, reason: "double slash" },
  { category: "Personal/./Health", expected: false, reason: "dot segment" },
  { category: "Personal/../Health", expected: false, reason: "dot-dot segment" },
  { category: "Personal/<Health>", expected: false, reason: "invalid chars" },
  { category: "Personal/Health|Fitness", expected: false, reason: "pipe char" },
  { category: "A".repeat(201), expected: false, reason: "too long" },
  { category: "A/".repeat(11) + "B", expected: false, reason: "too deep" },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = validateCategory(test.category);
  const isValid = result.valid;
  
  if (isValid === test.expected) {
    passed++;
    console.log(`✅ PASS: "${test.category.substring(0, 50)}${test.category.length > 50 ? '...' : ''}"`);
    if (!isValid) {
      console.log(`   Error: ${result.error}`);
    }
  } else {
    failed++;
    console.log(`❌ FAIL: "${test.category.substring(0, 50)}${test.category.length > 50 ? '...' : ''}"`);
    console.log(`   Expected: ${test.expected ? 'valid' : 'invalid'}`);
    console.log(`   Got: ${isValid ? 'valid' : 'invalid'}`);
    if (!isValid) {
      console.log(`   Error: ${result.error}`);
    }
    if (test.reason) {
      console.log(`   Reason: ${test.reason}`);
    }
  }
  console.log();
}

console.log(`\n${"=".repeat(50)}`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

if (failed === 0) {
  console.log("🎉 All tests passed!");
  process.exit(0);
} else {
  console.log("⚠️  Some tests failed!");
  process.exit(1);
}

