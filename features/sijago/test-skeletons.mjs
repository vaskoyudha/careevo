/**
 * Beautiful Skeleton Loading Animation Test Script
 * Run with: node test-skeletons.mjs
 */

import pw from "playwright";
const { chromium } = pw;

async function runTests() {
  console.log("🎨 Testing SiJago Beautiful Skeleton Loading Animations...\n");
  
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  // Track any errors
  const errors = [];
  const warnings = [];
  
  page.on("requestfailed", req => {
    const url = req.url();
    if (!url.includes("_next/image")) {
      errors.push(`Request failed: ${url}`);
    }
  });
  
  page.on("response", resp => {
    if (resp.status() >= 400) {
      warnings.push(`${resp.status()} ${resp.url()}`);
    }
  });
  
  // Test 1: Session Loading View (Chat)
  console.log("📍 Test 1: Chat Workspace - Session Loading");
  await page.goto("http://127.0.0.1:3790/learning", { 
    waitUntil: "networkidle", 
    timeout: 15000 
  });
  await page.waitForTimeout(2000);
  
  // Count careevo logo images
  const logoCount = await page.evaluate(() => {
    return [...document.querySelectorAll("img")].filter(img => 
      img.src && img.src.includes("careevo")
    ).length;
  });
  console.log(`   ✓ Found ${logoCount} Careevo logo images`);
  
  // Take screenshot of current view
  await page.screenshot({ 
    path: "/tmp/sijago-skeleton-test-chat.png",
    fullPage: true 
  });
  console.log("   📸 Screenshot saved to /tmp/sijago-skeleton-test-chat.png\n");
  
  // Test 2: Settings Page
  console.log("📍 Test 2: Settings Page Layout");
  await page.goto("http://127.0.0.1:3790/settings", { 
    waitUntil: "networkidle", 
    timeout: 15000 
  });
  await page.waitForTimeout(2000);
  
  const settingsElements = await page.evaluate(() => {
    return document.querySelectorAll('[class*="border"], [class*="bg-card"]');
  });
  console.log(`   ✓ Loaded ${settingsElements.length} skeleton/card elements`);
  
  await page.screenshot({ 
    path: "/tmp/sijago-skeleton-test-settings.png",
    fullPage: true 
  });
  console.log("   📸 Screenshot saved to /tmp/sijago-skeleton-test-settings.png\n");
  
  // Test 3: Collapsed Sidebar
  console.log("📍 Test 3: Collapsed Sidebar Rail");
  await page.goto("http://127.0.0.1:3790/learning", { 
    waitUntil: "networkidle", 
    timeout: 15000 
  });
  await page.waitForTimeout(1500);
  
  // Collapse sidebar
  const collapseBtn = page.getByRole("button", { name: /collapse/i });
  if (await collapseBtn.count() > 0) {
    await collapseBtn.first().click();
    await page.waitForTimeout(1000);
    
    const railLogo = await page.evaluate(() => {
      const img = document.querySelector('img[src*="careevo-mark"]');
      return img ? img.getBoundingClientRect() : null;
    });
    
    if (railLogo) {
      console.log(`   ✓ Mark visible: ${Math.round(railLogo.width)}x${Math.round(railLogo.height)}px`);
    } else {
      console.log(`   ⚠️  Mark not found (might be using different asset)`);
    }
  }
  
  await page.screenshot({ 
    path: "/tmp/sijago-skeleton-test-collapsed.png",
    fullPage: true 
  });
  console.log("   📸 Screenshot saved to /tmp/sijago-skeleton-test-collapsed.png\n");
  
  // Final summary
  console.log("═══════════════════════════════════════════════════");
  console.log("✅ TEST COMPLETE");
  console.log("═══════════════════════════════════════════════════\n");
  
  console.log("📊 Summary:");
  console.log(`   • Total screenshots: 3`);
  console.log(`   • Errors detected: ${errors.length || 0}`);
  console.log(`   • Warnings detected: ${warnings.length || 0}`);
  
  if (errors.length > 0) {
    console.log("\n❌ Errors:");
    errors.forEach(e => console.log(`   • ${e}`));
  }
  
  if (warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    warnings.forEach(w => console.log(`   • ${w}`));
  }
  
  console.log("\n📁 Screenshots location: /tmp/");
  console.log("   - sijago-skeleton-test-chat.png");
  console.log("   - sijago-skeleton-test-settings.png");
  console.log("   - sijago-skeleton-test-collapsed.png");
  
  await browser.close();
  
  // Exit with error code if there were errors
  process.exit(errors.length > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
